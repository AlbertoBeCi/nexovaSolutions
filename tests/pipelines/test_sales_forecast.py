"""Unit tests for the Nexova sales forecast model and 8/2-year temporal split."""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.train_sales_forecast import (  # noqa: E402
    DEFAULT_CSV_PATH,
    evaluate_predictions,
    load_and_validate_sales_data,
    save_forecast_plot,
    split_train_test,
    train_and_forecast,
)


def test_temporal_split_is_strictly_eight_years_train_and_two_years_test():
    df = load_and_validate_sales_data(DEFAULT_CSV_PATH)
    train_df, test_df = split_train_test(df)

    assert len(df) == 120
    assert len(train_df) == 96  # 8 years: 2016-01 .. 2023-12
    assert len(test_df) == 24   # 2 years: 2024-01 .. 2025-12
    assert train_df["month"].max() == pd.Timestamp("2023-12-01")
    assert test_df["month"].min() == pd.Timestamp("2024-01-01")
    assert train_df["month"].max() < test_df["month"].min()
    assert set(train_df["month"]).isdisjoint(set(test_df["month"]))


def test_recursive_forecast_has_zero_future_leakage_and_valid_variability_band(tmp_path):
    df = load_and_validate_sales_data(DEFAULT_CSV_PATH)
    train_df, test_df = split_train_test(df)

    _, forecast_orig = train_and_forecast(train_df, test_df["month"])

    # Mutate test_df targets: recursive forecast must remain identical bit-for-bit
    mutated_test = test_df.copy()
    mutated_test["revenue_usd"] = mutated_test["revenue_usd"] * 99.0
    _, forecast_after_mutation = train_and_forecast(train_df, mutated_test["month"])

    pd.testing.assert_frame_equal(forecast_orig, forecast_after_mutation)
    assert (forecast_orig["pred_p10_usd"] <= forecast_orig["pred_revenue_usd"]).all()
    assert (forecast_orig["pred_revenue_usd"] <= forecast_orig["pred_p90_usd"]).all()

    metrics = evaluate_predictions(train_df, test_df, forecast_orig)
    for key in ("mse_usd2", "rmse_usd", "rmse_pct_of_mean", "gini", "psi_level", "psi_yoy", "k2_score_r2"):
        assert key in metrics

    plot_path = tmp_path / "forecast.png"
    save_forecast_plot(test_df, forecast_orig, metrics, plot_path)
    assert plot_path.exists() and plot_path.stat().st_size > 0
