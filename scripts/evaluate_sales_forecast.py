"""Evaluacion tecnica formal del modelo de pronostico de ventas de Nexova.

Responde con evidencia empirica antes del paso a staging:
1. Validacion cruzada temporal (`TimeSeriesSplit`, n_splits=5, test_size=12) sobre
   la serie cruda de entrenamiento (2016-2023) sin fuga en limites de folds.
2. Curva de aprendizaje temporal (ventana expansiva) con MAE y RMSE en USD.
3. Diagnostico explicito de sesgo/varianza (`bien_ajustado`, `underfitting`,
   `overfitting`) y comparativa de acciones correctivas concretas en CV temporal.
4. Exporta `data/eval/sales_forecast_evaluation.json`,
   `data/eval/sales_forecast_learning_curve.png` y
   `data/eval/sales_forecast_cv_stability.png`.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit

from scripts.train_sales_forecast import (
    DEFAULT_CSV_PATH,
    DEFAULT_EVAL_DIR,
    FEATURE_COLUMNS,
    RANDOM_STATE,
    _compute_features_for_row,
    build_training_matrix,
    load_and_validate_sales_data,
    split_train_test,
)

STATIONARY_FEATURES = [
    "yoy_growth_lag_1",
    "yoy_growth_lag_12",
    "mom_ratio_lag_1",
    "ratio_to_roll12_lag_1",
    "month_num",
    "sin_month",
    "cos_month",
    "is_august",
    "is_jan_feb",
    "year_parity",
]

DEFAULT_RF_PARAMS: dict[str, Any] = {
    "n_estimators": 300,
    "max_depth": 6,
    "min_samples_leaf": 2,
    "max_features": 1.0,
    "random_state": RANDOM_STATE,
}


def _fit_and_score_fold(
    fold_train_raw: pd.DataFrame,
    fold_val_raw: pd.DataFrame,
    rf_params: dict[str, Any] | None = None,
    feature_cols: list[str] | None = None,
) -> dict[str, Any]:
    """Train on `fold_train_raw` only and forecast `fold_val_raw` recursively without leakage."""
    params = dict(DEFAULT_RF_PARAMS if rf_params is None else rf_params)
    cols = list(FEATURE_COLUMNS if feature_cols is None else feature_cols)

    X_train_full, y_train = build_training_matrix(fold_train_raw)
    X_train = X_train_full[cols]

    model = RandomForestRegressor(**params)
    model.fit(X_train, y_train)

    # Train reconstruction (1-step in-sample USD)
    revs_train = fold_train_raw["revenue_usd"].astype(float).tolist()
    lag12_train = np.array([revs_train[idx - 12] for idx in range(24, len(fold_train_raw))], dtype=float)
    y_train_usd_true = np.array(revs_train[24:], dtype=float)
    y_train_yoy_pred = model.predict(X_train)
    y_train_usd_pred = lag12_train * (1.0 + y_train_yoy_pred)

    train_mae_usd = float(mean_absolute_error(y_train_usd_true, y_train_usd_pred))
    train_rmse_usd = float(math.sqrt(mean_squared_error(y_train_usd_true, y_train_usd_pred)))
    train_rmse_yoy = float(math.sqrt(mean_squared_error(y_train, y_train_yoy_pred)))

    # Strict recursive validation forecast: only fold_train_raw + prior predictions
    history_revenues = list(revs_train)
    val_preds_usd: list[float] = []
    for m_ts in fold_val_raw["month"]:
        ts = pd.Timestamp(m_ts)
        feats = _compute_features_for_row(history_revenues, ts)
        x_row = pd.DataFrame([feats], columns=FEATURE_COLUMNS)[cols]
        pred_yoy = float(model.predict(x_row)[0])
        pred_usd = float(history_revenues[-12] * (1.0 + pred_yoy))
        history_revenues.append(pred_usd)
        val_preds_usd.append(pred_usd)

    y_val_usd_true = fold_val_raw["revenue_usd"].to_numpy(dtype=float)
    y_val_usd_pred = np.array(val_preds_usd, dtype=float)
    val_mae_usd = float(mean_absolute_error(y_val_usd_true, y_val_usd_pred))
    val_rmse_usd = float(math.sqrt(mean_squared_error(y_val_usd_true, y_val_usd_pred)))
    val_r2 = float(r2_score(y_val_usd_true, y_val_usd_pred))
    mean_val_rev = float(np.mean(y_val_usd_true))

    return {
        "train_rows_raw": int(len(fold_train_raw)),
        "train_rows_trainable": int(len(X_train)),
        "val_rows": int(len(fold_val_raw)),
        "train_start": fold_train_raw["month"].min().strftime("%Y-%m-%d"),
        "train_end": fold_train_raw["month"].max().strftime("%Y-%m-%d"),
        "val_start": fold_val_raw["month"].min().strftime("%Y-%m-%d"),
        "val_end": fold_val_raw["month"].max().strftime("%Y-%m-%d"),
        "train_mae_usd": round(train_mae_usd, 2),
        "train_rmse_usd": round(train_rmse_usd, 2),
        "train_rmse_yoy": round(train_rmse_yoy, 6),
        "val_mae_usd": round(val_mae_usd, 2),
        "val_rmse_usd": round(val_rmse_usd, 2),
        "val_rmse_pct_of_mean": round((val_rmse_usd / mean_val_rev) * 100.0, 2),
        "val_mae_pct_of_mean": round((val_mae_usd / mean_val_rev) * 100.0, 2),
        "val_r2": round(val_r2, 4),
    }


def run_temporal_cv(
    train_df: pd.DataFrame,
    n_splits: int = 5,
    test_size: int = 12,
    rf_params: dict[str, Any] | None = None,
    feature_cols: list[str] | None = None,
) -> dict[str, Any]:
    """Run `TimeSeriesSplit` directly on raw `train_df` before feature engineering."""
    tscv = TimeSeriesSplit(n_splits=n_splits, test_size=test_size)
    folds: list[dict[str, Any]] = []

    for fold_num, (train_idx, val_idx) in enumerate(tscv.split(train_df), start=1):
        if int(np.max(train_idx)) >= int(np.min(val_idx)):
            raise AssertionError("Violacion de orden cronologico en TimeSeriesSplit.")
        fold_train_raw = train_df.iloc[train_idx].copy().reset_index(drop=True)
        fold_val_raw = train_df.iloc[val_idx].copy().reset_index(drop=True)

        metrics = _fit_and_score_fold(
            fold_train_raw,
            fold_val_raw,
            rf_params=rf_params,
            feature_cols=feature_cols,
        )
        metrics["fold"] = fold_num
        metrics["train_idx_min"] = int(np.min(train_idx))
        metrics["train_idx_max"] = int(np.max(train_idx))
        metrics["val_idx_min"] = int(np.min(val_idx))
        metrics["val_idx_max"] = int(np.max(val_idx))
        folds.append(metrics)

    def _agg(key: str) -> dict[str, float]:
        vals = np.array([f[key] for f in folds], dtype=float)
        mean_v = float(np.mean(vals))
        std_v = float(np.std(vals, ddof=1)) if len(vals) > 1 else 0.0
        return {
            "mean": round(mean_v, 2),
            "std": round(std_v, 2),
            "min": round(float(np.min(vals)), 2),
            "max": round(float(np.max(vals)), 2),
            "cv_pct": round((std_v / mean_v) * 100.0, 2) if mean_v > 0 else 0.0,
        }

    return {
        "n_splits": n_splits,
        "test_size": test_size,
        "folds": folds,
        "summary": {
            "train_rmse_usd": _agg("train_rmse_usd"),
            "val_rmse_usd": _agg("val_rmse_usd"),
            "train_mae_usd": _agg("train_mae_usd"),
            "val_mae_usd": _agg("val_mae_usd"),
            "val_r2": _agg("val_r2"),
        },
    }


def compute_learning_curve(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    prefix_sizes: list[int] | None = None,
) -> list[dict[str, Any]]:
    """Compute expanding-window learning curve (train error vs validation & hold-out error)."""
    sizes = [36, 48, 60, 72, 84] if prefix_sizes is None else prefix_sizes
    points: list[dict[str, Any]] = []

    for size in sizes:
        prefix_raw = train_df.iloc[:size].copy().reset_index(drop=True)
        # Validate on the immediately following 12 months inside train_df when available,
        # otherwise on the first 12 months of test_df
        if size + 12 <= len(train_df):
            next_val_raw = train_df.iloc[size : size + 12].copy().reset_index(drop=True)
        else:
            next_val_raw = test_df.iloc[:12].copy().reset_index(drop=True)

        fold_metrics = _fit_and_score_fold(prefix_raw, next_val_raw)
        points.append(
            {
                "train_months_raw": int(size),
                "train_months_trainable": int(fold_metrics["train_rows_trainable"]),
                "train_end": fold_metrics["train_end"],
                "val_period": f"{fold_metrics['val_start'][:7]}..{fold_metrics['val_end'][:7]}",
                "train_rmse_usd": fold_metrics["train_rmse_usd"],
                "val_rmse_usd": fold_metrics["val_rmse_usd"],
                "train_mae_usd": fold_metrics["train_mae_usd"],
                "val_mae_usd": fold_metrics["val_mae_usd"],
            }
        )

    return points


def diagnose_bias_variance(cv_result: dict[str, Any]) -> dict[str, Any]:
    """Classify model fit as `bien_ajustado`, `underfitting`, or `overfitting`."""
    summary = cv_result["summary"]
    train_rmse = summary["train_rmse_usd"]["mean"]
    val_rmse = summary["val_rmse_usd"]["mean"]
    val_std = summary["val_rmse_usd"]["std"]
    gap_usd = val_rmse - train_rmse
    gap_ratio = (val_rmse / train_rmse) if train_rmse > 0 else 1.0

    # Nexova monthly revenue is ~650k-960k USD; 5% is ~40k USD.
    if train_rmse > 45_000.0 and gap_ratio < 1.35:
        classification = "underfitting"
        rationale = (
            "Tanto entrenamiento como validacion convergen en un error alto (> $45,000 USD), "
            "indicando incapacidad para capturar la estacionalidad y tendencia."
        )
    elif gap_ratio >= 1.60:
        classification = "overfitting"
        rationale = (
            f"Existe una brecha amplia y persistente entre entrenamiento (${train_rmse:,.0f}) "
            f"y validacion (${val_rmse:,.0f}, ratio {gap_ratio:.2f}x), indicando memorizacion "
            "parcial del ruido o de la escala nominal en arboles profundos."
        )
    else:
        classification = "bien_ajustado"
        rationale = (
            f"Entrenamiento (${train_rmse:,.0f}) y validacion (${val_rmse:,.0f}) convergen "
            f"en un error bajo (<5% del ingreso medio) con brecha controlada (ratio {gap_ratio:.2f}x)."
        )

    return {
        "classification": classification,
        "train_rmse_mean_usd": round(train_rmse, 2),
        "val_rmse_mean_usd": round(val_rmse, 2),
        "val_rmse_std_usd": round(val_std, 2),
        "gap_usd": round(gap_usd, 2),
        "gap_ratio": round(gap_ratio, 2),
        "rationale": rationale,
    }


def run_corrective_experiments(train_df: pd.DataFrame) -> list[dict[str, Any]]:
    """Evaluate concrete corrective candidates on `TimeSeriesSplit(n_splits=5, test_size=12)`."""
    candidates: list[tuple[str, dict[str, Any], list[str]]] = [
        (
            "baseline_actual (depth=6, leaf=2, 13 features)",
            {**DEFAULT_RF_PARAMS},
            FEATURE_COLUMNS,
        ),
        (
            "regularizacion_moderada (depth=4, leaf=4, sqrt, 13 features)",
            {**DEFAULT_RF_PARAMS, "max_depth": 4, "min_samples_leaf": 4, "max_features": "sqrt"},
            FEATURE_COLUMNS,
        ),
        (
            "regularizacion_fuerte (depth=3, leaf=5, sqrt, 13 features)",
            {**DEFAULT_RF_PARAMS, "max_depth": 3, "min_samples_leaf": 5, "max_features": "sqrt"},
            FEATURE_COLUMNS,
        ),
        (
            "poda_features_nivel + reg (depth=4, leaf=3, 10 features estacionarias)",
            {**DEFAULT_RF_PARAMS, "max_depth": 4, "min_samples_leaf": 3, "max_features": 1.0},
            STATIONARY_FEATURES,
        ),
        (
            "alta_complejidad_control (depth=None, leaf=1, 13 features)",
            {**DEFAULT_RF_PARAMS, "max_depth": None, "min_samples_leaf": 1},
            FEATURE_COLUMNS,
        ),
    ]

    results: list[dict[str, Any]] = []
    for name, params, cols in candidates:
        cv = run_temporal_cv(train_df, n_splits=5, test_size=12, rf_params=params, feature_cols=cols)
        diag = diagnose_bias_variance(cv)
        results.append(
            {
                "candidate": name,
                "classification": diag["classification"],
                "train_rmse_mean_usd": cv["summary"]["train_rmse_usd"]["mean"],
                "val_rmse_mean_usd": cv["summary"]["val_rmse_usd"]["mean"],
                "val_rmse_std_usd": cv["summary"]["val_rmse_usd"]["std"],
                "val_mae_mean_usd": cv["summary"]["val_mae_usd"]["mean"],
                "val_mae_std_usd": cv["summary"]["val_mae_usd"]["std"],
                "gap_ratio": diag["gap_ratio"],
            }
        )
    return results


def save_learning_curve_plot(points: list[dict[str, Any]], output_path: Path) -> None:
    """Plot RMSE and MAE learning curves (train vs validation) to `output_path`."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    x = [p["train_months_trainable"] for p in points]

    fig, axes = plt.subplots(1, 2, figsize=(12, 4.8), dpi=150)

    axes[0].plot(x, [p["train_rmse_usd"] / 1000 for p in points], marker="o", color="#1f4e37", linewidth=2.0, label="Entrenamiento")
    axes[0].plot(x, [p["val_rmse_usd"] / 1000 for p in points], marker="s", color="#c05621", linewidth=2.0, linestyle="--", label="Validación temporal (12m)")
    axes[0].set_title("Curva de aprendizaje — RMSE (miles USD)", fontweight="bold")
    axes[0].set_xlabel("Meses entrenables (tras lag_24)")
    axes[0].set_ylabel("RMSE (miles USD)")
    axes[0].grid(True, linestyle=":", alpha=0.5)
    axes[0].legend()

    axes[1].plot(x, [p["train_mae_usd"] / 1000 for p in points], marker="o", color="#1f4e37", linewidth=2.0, label="Entrenamiento")
    axes[1].plot(x, [p["val_mae_usd"] / 1000 for p in points], marker="s", color="#c05621", linewidth=2.0, linestyle="--", label="Validación temporal (12m)")
    axes[1].set_title("Curva de aprendizaje — MAE (miles USD)", fontweight="bold")
    axes[1].set_xlabel("Meses entrenables (tras lag_24)")
    axes[1].set_ylabel("MAE (miles USD)")
    axes[1].grid(True, linestyle=":", alpha=0.5)
    axes[1].legend()

    fig.suptitle("Nexova Solutions — Diagnóstico Sesgo / Varianza (Ventana Expansiva)", fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(output_path)
    plt.close(fig)


def save_cv_stability_plot(cv_result: dict[str, Any], output_path: Path) -> None:
    """Plot per-fold train vs validation RMSE with mean +/- std band."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    folds = cv_result["folds"]
    labels = [f"Fold {f['fold']}\n({f['val_start'][:4]})" for f in folds]
    x = np.arange(len(folds))
    train_rmse = [f["train_rmse_usd"] / 1000 for f in folds]
    val_rmse = [f["val_rmse_usd"] / 1000 for f in folds]

    mean_val = cv_result["summary"]["val_rmse_usd"]["mean"] / 1000
    std_val = cv_result["summary"]["val_rmse_usd"]["std"] / 1000

    fig, ax = plt.subplots(figsize=(10, 4.8), dpi=150)
    width = 0.35
    ax.bar(x - width / 2, train_rmse, width, color="#68b684", label="RMSE Entrenamiento")
    ax.bar(x + width / 2, val_rmse, width, color="#1f4e37", label="RMSE Validación (12m)")
    ax.axhline(mean_val, color="#c05621", linestyle="--", linewidth=1.6, label=f"Media Validación (${mean_val:.1f}k)")
    ax.axhspan(mean_val - std_val, mean_val + std_val, color="#c05621", alpha=0.12, label=f"±1 Desv. Est. (±${std_val:.1f}k)")

    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.set_ylabel("RMSE (miles USD)")
    ax.set_title("Nexova Solutions — Estabilidad en Validación Cruzada Temporal (TimeSeriesSplit, 5 folds)", fontweight="bold")
    ax.grid(True, axis="y", linestyle=":", alpha=0.5)
    ax.legend(loc="upper right", fontsize=8.5)

    fig.tight_layout()
    fig.savefig(output_path)
    plt.close(fig)


def run_evaluation_pipeline(
    csv_path: Path = DEFAULT_CSV_PATH,
    eval_dir: Path = DEFAULT_EVAL_DIR,
) -> dict[str, Any]:
    """Run full temporal CV, learning curve, bias/variance diagnosis, and corrective comparison."""
    df = load_and_validate_sales_data(csv_path)
    train_df, test_df = split_train_test(df)

    cv_result = run_temporal_cv(train_df, n_splits=5, test_size=12)
    learning_curve = compute_learning_curve(train_df, test_df)
    diagnosis = diagnose_bias_variance(cv_result)
    experiments = run_corrective_experiments(train_df)

    payload = {
        "model": "RandomForestRegressor",
        "baseline_params": DEFAULT_RF_PARAMS,
        "cv_temporal": cv_result,
        "learning_curve": learning_curve,
        "diagnosis": diagnosis,
        "corrective_experiments": experiments,
    }

    eval_dir.mkdir(parents=True, exist_ok=True)
    (eval_dir / "sales_forecast_evaluation.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    save_learning_curve_plot(learning_curve, eval_dir / "sales_forecast_learning_curve.png")
    save_cv_stability_plot(cv_result, eval_dir / "sales_forecast_cv_stability.png")
    return payload


def main() -> int:
    payload = run_evaluation_pipeline()
    print(json.dumps({"diagnosis": payload["diagnosis"], "cv_summary": payload["cv_temporal"]["summary"]}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
