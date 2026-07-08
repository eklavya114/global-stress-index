"""
XGBoost-based Pulse Scorer.

On first use, trains three XGBoost models (conflict, food, economic) on
synthetic data bootstrapped from domain-expert weighting rules. Models are
saved to backend/models/ and reused on subsequent runs.
"""
import logging
import os
import pickle
from pathlib import Path

import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parents[3] / "models"
MODEL_PATHS = {
    "conflict":  MODEL_DIR / "conflict_scorer.pkl",
    "food":      MODEL_DIR / "food_scorer.pkl",
    "economic":  MODEL_DIR / "economic_scorer.pkl",
}

# Feature indices (see features.py FEATURE_NAMES)
CONFLICT_FEAT  = [0, 1, 2, 3, 9]   # events, fatalities, gdelt_events, gdelt_tone, displacement
FOOD_FEAT      = [4, 5, 9]          # food_price, food_security, displacement
ECONOMIC_FEAT  = [6, 7, 8]          # gdp_stress, inflation, unemployment

N_SYNTHETIC = 8000
NOISE_STD   = 0.05


def _rule_labels(X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generate rule-based labels 0-100 for synthetic samples."""
    # Conflict: heavy on events & fatalities
    c = (X[:, 0] * 0.30 + X[:, 1] * 0.35 + X[:, 2] * 0.15 + X[:, 3] * 0.15 + X[:, 9] * 0.05)
    # Food: price + security, displacement contributes
    f = (X[:, 4] * 0.45 + X[:, 5] * 0.40 + X[:, 9] * 0.15)
    # Economic: GDP stress dominant
    e = (X[:, 6] * 0.45 + X[:, 7] * 0.35 + X[:, 8] * 0.20)

    c = np.clip(c + np.random.normal(0, NOISE_STD, len(c)), 0, 1) * 100
    f = np.clip(f + np.random.normal(0, NOISE_STD, len(f)), 0, 1) * 100
    e = np.clip(e + np.random.normal(0, NOISE_STD, len(e)), 0, 1) * 100
    return c, f, e


def _train_xgb(X_train: np.ndarray, y_train: np.ndarray) -> xgb.XGBRegressor:
    model = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
        random_state=42,
        verbosity=0,
    )
    model.fit(X_train, y_train, eval_set=[(X_train, y_train)], verbose=False)
    return model


def train_and_save() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    np.random.seed(42)
    X = np.random.rand(N_SYNTHETIC, 10).astype(np.float32)
    c_labels, f_labels, e_labels = _rule_labels(X)

    for name, feat_idx, labels, path in [
        ("conflict",  CONFLICT_FEAT,  c_labels, MODEL_PATHS["conflict"]),
        ("food",      FOOD_FEAT,      f_labels, MODEL_PATHS["food"]),
        ("economic",  ECONOMIC_FEAT,  e_labels, MODEL_PATHS["economic"]),
    ]:
        X_sub = X[:, feat_idx]
        model = _train_xgb(X_sub, labels)
        with open(path, "wb") as f:
            pickle.dump(model, f)
        logger.info(f"Trained & saved {name} model → {path}")


def load_models() -> dict[str, xgb.XGBRegressor]:
    models = {}
    for name, path in MODEL_PATHS.items():
        with open(path, "rb") as f:
            models[name] = pickle.load(f)
    return models


class PulseScorer:
    def __init__(self):
        self._models: dict[str, xgb.XGBRegressor] | None = None

    def _ensure_models(self) -> None:
        if self._models:
            return
        if not all(p.exists() for p in MODEL_PATHS.values()):
            logger.info("No trained models found — training on synthetic data…")
            train_and_save()
        self._models = load_models()

    def score(self, features: np.ndarray) -> tuple[float, float, float, float]:
        """
        features: shape (10,) — normalized 0-1 vector from features.py
        Returns: (pulse_score, conflict_score, food_score, economic_score) all 0-100
        """
        self._ensure_models()
        assert self._models is not None

        x = features.reshape(1, -1).astype(np.float32)
        conflict  = float(np.clip(self._models["conflict"].predict(x[:, CONFLICT_FEAT])[0],  0, 100))
        food      = float(np.clip(self._models["food"].predict(x[:, FOOD_FEAT])[0],          0, 100))
        economic  = float(np.clip(self._models["economic"].predict(x[:, ECONOMIC_FEAT])[0],  0, 100))
        pulse     = round(0.40 * conflict + 0.30 * food + 0.30 * economic, 2)

        return round(pulse, 2), round(conflict, 2), round(food, 2), round(economic, 2)


# Module-level singleton
scorer = PulseScorer()
