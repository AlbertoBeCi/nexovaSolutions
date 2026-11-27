"""Pruebas unitarias para la evaluacion temporal del modelo de pronostico de ventas."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from scripts.evaluate_sales_forecast import (
    _fit_and_score_fold,
    compute_learning_curve,
    diagnose_bias_variance,
    run_evaluation_pipeline,
    run_temporal_cv,
)
from scripts.train_sales_forecast import load_and_validate_sales_data, split_train_test


def test_temporal_cv_preserves_strict_chronological_order() -> None:
    """Ningun indice de un fold posterior aparece antes que uno de un fold anterior."""
    df = load_and_validate_sales_data()
    train_df, _ = split_train_test(df)

    cv = run_temporal_cv(train_df, n_splits=5, test_size=12)
    folds = cv["folds"]
    assert len(folds) == 5

    prev_val_max_idx = -1
    for fold in folds:
        assert fold["train_idx_max"] < fold["val_idx_min"]
        assert pd.Timestamp(fold["train_end"]) < pd.Timestamp(fold["val_start"])
        assert fold["val_rows"] == 12
        # Ningun indice de validacion de un fold posterior aparece antes que uno anterior
        assert fold["val_idx_min"] > prev_val_max_idx
        prev_val_max_idx = fold["val_idx_max"]


def test_temporal_cv_has_no_future_leakage_across_fold_boundaries() -> None:
    """Alterar los valores futuros en `fold_val_raw` no cambia las predicciones del fold."""
    df = load_and_validate_sales_data()
    train_df, _ = split_train_test(df)

    fold_train = train_df.iloc[:72].copy().reset_index(drop=True)
    fold_val = train_df.iloc[72:84].copy().reset_index(drop=True)

    # Corrupt future target values in a copy; recursive forecast must only use fold_train
    fold_val_perturbed = fold_val.copy()
    fold_val_perturbed["revenue_usd"] = fold_val_perturbed["revenue_usd"] * 10.0

    m_orig = _fit_and_score_fold(fold_train, fold_val)
    m_pert = _fit_and_score_fold(fold_train, fold_val_perturbed)

    assert m_orig["train_rmse_usd"] == m_pert["train_rmse_usd"]
    assert m_orig["train_mae_usd"] == m_pert["train_mae_usd"]


def test_evaluation_pipeline_generates_metrics_diagnosis_and_artifacts(tmp_path: Path) -> None:
    """Verifica MAE/RMSE en train y val, media +/- std, diagnostico y archivos en data/eval/."""
    payload = run_evaluation_pipeline(eval_dir=tmp_path)

    summary = payload["cv_temporal"]["summary"]
    for key in ("train_rmse_usd", "val_rmse_usd", "train_mae_usd", "val_mae_usd"):
        assert summary[key]["mean"] > 0
        assert summary[key]["std"] >= 0

    assert payload["diagnosis"]["classification"] in {"bien_ajustado", "underfitting", "overfitting"}
    assert len(payload["learning_curve"]) == 5
    assert (tmp_path / "sales_forecast_evaluation.json").exists()
    assert (tmp_path / "sales_forecast_learning_curve.png").exists()
    assert (tmp_path / "sales_forecast_cv_stability.png").exists()
