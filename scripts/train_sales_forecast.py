"""Entrenamiento y evaluacion del modelo de pronostico de ventas mensuales de Nexova.

Implementa el briefing `briefing/sales-forecasting-briefing.md`:
- Carga `data/raw/nexova_sales.csv` (120 meses consolidados: 2016-01 a 2025-12).
- Split temporal estricto: primeros 8 anos (2016-2023) para entrenamiento,
  ultimos 2 anos (2024-2025) como prueba sin fuga de informacion futura.
- Modelo elegido: `RandomForestRegressor` sobre el crecimiento interanual
  estacionario (`revenue_usd / lag_12 - 1`), reconstruido recursivamente para
  los 24 meses de prueba, evitando el techo de extrapolacion de los arboles.
- Calcula MSE (USD^2 + RMSE y % sobre ingreso promedio), Gini, PSI y K2 Score
  (R^2 y estadistico K^2 de normalidad de residuos).
- Genera la visualizacion con banda de variabilidad P10-P90 en
  `data/eval/sales_forecast_2024_2025.png` y metricas en
  `data/eval/sales_forecast_metrics.json`.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd
from scipy.stats import normaltest
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV_PATH = REPO_ROOT / "data" / "raw" / "nexova_sales.csv"
DEFAULT_EVAL_DIR = REPO_ROOT / "data" / "eval"
SPLIT_DATE = pd.Timestamp("2024-01-01")
RANDOM_STATE = 42

FEATURE_COLUMNS = [
    "yoy_growth_lag_1",
    "yoy_growth_lag_12",
    "mom_ratio_lag_1",
    "ratio_to_roll12_lag_1",
    "rolling_mean_3",
    "rolling_std_3",
    "rolling_mean_12",
    "month_num",
    "sin_month",
    "cos_month",
    "is_august",
    "is_jan_feb",
    "year_parity",
]


def load_and_validate_sales_data(csv_path: Path = DEFAULT_CSV_PATH) -> pd.DataFrame:
    """Load `nexova_sales.csv`, filter consolidated rows, and enforce business constraints."""
    df = pd.read_csv(csv_path)
    df = df.loc[df["business_line"] == "consolidated"].copy()
    df["month"] = pd.to_datetime(df["month"], format="%Y-%m-%d")
    df = df.sort_values("month").reset_index(drop=True)

    if len(df) != 120:
        raise ValueError(f"Se esperaban 120 meses consolidados (2016-01..2025-12), hay {len(df)}.")
    expected_months = pd.date_range("2016-01-01", "2025-12-01", freq="MS")
    if not df["month"].equals(pd.Series(expected_months, name="month")):
        raise ValueError("Faltan meses o hay fechas inesperadas en el rango 2016-01 a 2025-12.")
    if (df["revenue_usd"] <= 0).any():
        raise ValueError("Todos los valores de revenue_usd deben ser positivos.")

    return df


def split_train_test(
    df: pd.DataFrame, split_date: pd.Timestamp = SPLIT_DATE
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Strict 8-year train / 2-year test temporal split."""
    train = df.loc[df["month"] < split_date].copy().reset_index(drop=True)
    test = df.loc[df["month"] >= split_date].copy().reset_index(drop=True)
    return train, test


def _compute_features_for_row(history_revenues: list[float], month_ts: pd.Timestamp) -> dict[str, float]:
    """Build strictly causal features for `month_ts` using only `history_revenues` (< month_ts)."""
    if len(history_revenues) < 24:
        raise ValueError("Se requieren al menos 24 meses previos para construir lag_24.")

    lag_1 = history_revenues[-1]
    lag_2 = history_revenues[-2]
    lag_12 = history_revenues[-12]
    lag_13 = history_revenues[-13]
    lag_24 = history_revenues[-24]

    roll_3 = float(np.mean(history_revenues[-3:]))
    roll_std_3 = float(np.std(history_revenues[-3:], ddof=1))
    roll_12 = float(np.mean(history_revenues[-12:]))

    m = int(month_ts.month)
    return {
        "yoy_growth_lag_1": (lag_1 / lag_13) - 1.0,
        "yoy_growth_lag_12": (lag_12 / lag_24) - 1.0,
        "mom_ratio_lag_1": (lag_1 / lag_2) - 1.0,
        "ratio_to_roll12_lag_1": lag_1 / roll_12,
        "rolling_mean_3": roll_3,
        "rolling_std_3": roll_std_3,
        "rolling_mean_12": roll_12,
        "month_num": float(m),
        "sin_month": math.sin(2.0 * math.pi * m / 12.0),
        "cos_month": math.cos(2.0 * math.pi * m / 12.0),
        "is_august": 1.0 if m == 8 else 0.0,
        "is_jan_feb": 1.0 if m in (1, 2) else 0.0,
        "year_parity": float(month_ts.year % 2),
    }


def build_training_matrix(train_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Build causal feature matrix X and stationary YoY target y from `train_df` only."""
    revenues = train_df["revenue_usd"].astype(float).tolist()
    months = train_df["month"].tolist()

    rows: list[dict[str, float]] = []
    targets: list[float] = []
    for idx in range(24, len(train_df)):
        feats = _compute_features_for_row(revenues[:idx], months[idx])
        lag_12 = revenues[idx - 12]
        y_yoy = (revenues[idx] / lag_12) - 1.0
        rows.append(feats)
        targets.append(y_yoy)

    return pd.DataFrame(rows, columns=FEATURE_COLUMNS), pd.Series(targets, name="y_yoy")


def normalized_gini(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Compute normalized Gini coefficient between actual and predicted values."""
    def _raw_gini(actual: np.ndarray, order_by: np.ndarray) -> float:
        idx = np.argsort(order_by, kind="mergesort")
        sorted_actual = actual[idx]
        n = len(sorted_actual)
        cum_actual = np.cumsum(sorted_actual)
        sum_actual = cum_actual[-1]
        if sum_actual == 0:
            return 0.0
        lorentz = cum_actual / sum_actual
        uniform = np.arange(1, n + 1) / n
        return float(np.sum(uniform - lorentz) / n)

    denom = _raw_gini(y_true, y_true)
    if denom == 0:
        return 0.0
    return float(_raw_gini(y_true, y_pred) / denom)


def compute_psi(expected: np.ndarray, actual: np.ndarray, bins: int = 5) -> float:
    """Compute Population Stability Index (PSI) between training and test distributions."""
    quantiles = np.linspace(0.0, 1.0, bins + 1)
    bin_edges = np.quantile(expected, quantiles)
    bin_edges[0] = -np.inf
    bin_edges[-1] = np.inf
    # Deduplicate edges if distribution is narrow
    bin_edges = np.unique(bin_edges)
    if len(bin_edges) < 3:
        return 0.0

    exp_counts, _ = np.histogram(expected, bins=bin_edges)
    act_counts, _ = np.histogram(actual, bins=bin_edges)

    eps = 1e-4
    exp_pct = np.clip(exp_counts / len(expected), eps, None)
    act_pct = np.clip(act_counts / len(actual), eps, None)
    return float(np.sum((act_pct - exp_pct) * np.log(act_pct / exp_pct)))


def train_and_forecast(
    train_df: pd.DataFrame,
    test_months: pd.Series | list[pd.Timestamp],
) -> tuple[RandomForestRegressor, pd.DataFrame]:
    """Train RandomForest on `train_df` and forecast recursively over `test_months` without leakage."""
    X_train, y_train = build_training_matrix(train_df)
    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=6,
        min_samples_leaf=2,
        random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train)

    # Recursive multi-step forecast: only past real values (< 2024-01) + prior predictions
    history_revenues = train_df["revenue_usd"].astype(float).tolist()
    forecast_rows: list[dict[str, Any]] = []

    for m_ts in test_months:
        ts = pd.Timestamp(m_ts)
        feats = _compute_features_for_row(history_revenues, ts)
        x_row = pd.DataFrame([feats], columns=FEATURE_COLUMNS)

        tree_yoy_preds = np.array([tree.predict(x_row.to_numpy())[0] for tree in model.estimators_])
        lag_12 = history_revenues[-12]
        tree_rev_preds = lag_12 * (1.0 + tree_yoy_preds)

        pred_mean = float(np.mean(tree_rev_preds))
        pred_p10 = float(np.percentile(tree_rev_preds, 10))
        pred_p90 = float(np.percentile(tree_rev_preds, 90))

        history_revenues.append(pred_mean)
        forecast_rows.append(
            {
                "month": ts,
                "pred_revenue_usd": pred_mean,
                "pred_p10_usd": pred_p10,
                "pred_p90_usd": pred_p90,
            }
        )

    return model, pd.DataFrame(forecast_rows)


def evaluate_predictions(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    forecast_df: pd.DataFrame,
) -> dict[str, Any]:
    """Compute MSE, RMSE (% of mean), Gini, PSI, and K2 Score (R^2 + D'Agostino K^2)."""
    y_true = test_df["revenue_usd"].to_numpy(dtype=float)
    y_pred = forecast_df["pred_revenue_usd"].to_numpy(dtype=float)

    mse = float(mean_squared_error(y_true, y_pred))
    rmse = float(math.sqrt(mse))
    mean_test_rev = float(np.mean(y_true))
    rmse_pct = float((rmse / mean_test_rev) * 100.0)
    gini = normalized_gini(y_true, y_pred)

    train_rev = train_df["revenue_usd"].to_numpy(dtype=float)
    psi_level = compute_psi(train_rev, y_true, bins=5)

    train_yoy = (train_df["revenue_usd"] / train_df["revenue_usd"].shift(12) - 1.0).dropna().to_numpy()
    full_test_yoy = pd.concat(
        [train_df["revenue_usd"].iloc[-12:], test_df["revenue_usd"]], ignore_index=True
    )
    test_yoy = (full_test_yoy / full_test_yoy.shift(12) - 1.0).dropna().to_numpy()
    psi_yoy = compute_psi(train_yoy, test_yoy, bins=5)

    r2 = float(r2_score(y_true, y_pred))
    residuals = y_true - y_pred
    k2_stat, k2_pvalue = normaltest(residuals)

    return {
        "model": "RandomForestRegressor",
        "train_period": f"{train_df['month'].min().strftime('%Y-%m')} .. {train_df['month'].max().strftime('%Y-%m')}",
        "test_period": f"{test_df['month'].min().strftime('%Y-%m')} .. {test_df['month'].max().strftime('%Y-%m')}",
        "train_months": int(len(train_df)),
        "test_months": int(len(test_df)),
        "mse_usd2": round(mse, 2),
        "rmse_usd": round(rmse, 2),
        "mean_test_revenue_usd": round(mean_test_rev, 2),
        "rmse_pct_of_mean": round(rmse_pct, 2),
        "gini": round(gini, 4),
        "psi_level": round(psi_level, 4),
        "psi_yoy": round(psi_yoy, 4),
        "k2_score_r2": round(r2, 4),
        "k2_normality_stat": round(float(k2_stat), 4),
        "k2_normality_pvalue": round(float(k2_pvalue), 4),
    }


def save_forecast_plot(
    test_df: pd.DataFrame,
    forecast_df: pd.DataFrame,
    metrics: dict[str, Any],
    output_path: Path,
) -> None:
    """Render and save actual vs predicted revenue with P10-P90 variability band."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(11, 5.5), dpi=150)

    months = test_df["month"]
    ax.fill_between(
        months,
        forecast_df["pred_p10_usd"] / 1_000.0,
        forecast_df["pred_p90_usd"] / 1_000.0,
        color="#68b684",
        alpha=0.25,
        label="Rango de variabilidad (P10–P90 del bosque)",
    )
    ax.plot(
        months,
        test_df["revenue_usd"] / 1_000.0,
        color="#121513",
        linewidth=2.2,
        marker="o",
        markersize=4.5,
        label="Ingresos reales (2024–2025)",
    )
    ax.plot(
        months,
        forecast_df["pred_revenue_usd"] / 1_000.0,
        color="#1f4e37",
        linewidth=2.0,
        linestyle="--",
        marker="s",
        markersize=4.0,
        label="Predicción Random Forest",
    )

    ax.set_title(
        "Nexova Solutions — Pronóstico Mensual de Ingresos vs Real (Hold-out 2024–2025)",
        fontsize=12,
        fontweight="bold",
        pad=12,
    )
    ax.set_ylabel("Ingresos mensuales (miles de USD)")
    ax.set_xlabel("Mes")
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    plt.xticks(rotation=35, ha="right")
    ax.grid(True, linestyle=":", alpha=0.5)
    ax.legend(loc="upper left", frameon=True)

    summary_text = (
        f"RMSE: ${metrics['rmse_usd']:,.0f} ({metrics['rmse_pct_of_mean']:.1f}% del ingreso medio)\n"
        f"Gini: {metrics['gini']:.3f}  |  R² (K2 Score): {metrics['k2_score_r2']:.3f}  |  PSI (YoY): {metrics['psi_yoy']:.3f}"
    )
    ax.text(
        0.985,
        0.04,
        summary_text,
        transform=ax.transAxes,
        ha="right",
        va="bottom",
        fontsize=8.5,
        bbox={"boxstyle": "round,pad=0.4", "facecolor": "#f4f3ef", "edgecolor": "#d2cec4"},
    )

    fig.tight_layout()
    fig.savefig(output_path)
    plt.close(fig)


def run_pipeline(
    csv_path: Path = DEFAULT_CSV_PATH,
    eval_dir: Path = DEFAULT_EVAL_DIR,
) -> dict[str, Any]:
    """Execute full load, 8/2 split, training, evaluation, and artifact generation."""
    df = load_and_validate_sales_data(csv_path)
    train_df, test_df = split_train_test(df)
    _model, forecast_df = train_and_forecast(train_df, test_df["month"])
    metrics = evaluate_predictions(train_df, test_df, forecast_df)

    eval_dir.mkdir(parents=True, exist_ok=True)
    metrics_path = eval_dir / "sales_forecast_metrics.json"
    plot_path = eval_dir / "sales_forecast_2024_2025.png"

    metrics_path.write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    save_forecast_plot(test_df, forecast_df, metrics, plot_path)
    return metrics


def main() -> int:
    metrics = run_pipeline()
    print(json.dumps(metrics, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
