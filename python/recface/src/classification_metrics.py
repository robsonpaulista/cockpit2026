"""Métricas de classificação (Unidade 4) com scikit-learn — para relatório e ementa."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)


@dataclass
class MetricsResult:
    accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    f1_weighted: float
    labels: List[str]
    confusion: np.ndarray
    report_text: str

    def confusion_dataframe(self) -> pd.DataFrame:
        """Matriz com rótulos de linhas/colunas ordenados."""
        cols = ["previsto_" + lab for lab in self.labels]
        idx = ["verdade_" + lab for lab in self.labels]
        return pd.DataFrame(self.confusion, index=idx, columns=cols)


def compute_classification_metrics(df: pd.DataFrame) -> Tuple[Optional[MetricsResult], Optional[str]]:
    """
    Espera colunas ``rotulo_verdade`` e ``rotulo_previsto`` (strings).
    Ignora linhas com qualquer valor vazio.
    """
    need = {"rotulo_verdade", "rotulo_previsto"}
    if df is None or df.empty:
        return None, "Nenhuma linha na tabela."
    cols = set(str(c).strip() for c in df.columns)
    if not need.issubset(cols):
        return (
            None,
            f"Tabela deve conter colunas {sorted(need)}; recebidas: {sorted(cols)}.",
        )

    work = df[list(need)].copy()
    work = work.dropna(how="any")
    work["rotulo_verdade"] = work["rotulo_verdade"].astype(str).str.strip()
    work["rotulo_previsto"] = work["rotulo_previsto"].astype(str).str.strip()
    work = work[(work["rotulo_verdade"] != "") & (work["rotulo_previsto"] != "")]
    if work.empty:
        return None, "Nenhuma linha válida após remover valores vazios."

    y_true = work["rotulo_verdade"].tolist()
    y_pred = work["rotulo_previsto"].tolist()
    labels = sorted(set(y_true) | set(y_pred))

    if len(labels) < 1:
        return None, "Sem rótulos distintos."

    acc = float(accuracy_score(y_true, y_pred))
    prec = float(precision_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))
    rec = float(recall_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))
    f1_mac = float(f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0))
    f1_weighted = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))
    cm = confusion_matrix(y_true, y_pred, labels=labels)

    report = classification_report(
        y_true,
        y_pred,
        labels=labels,
        digits=4,
        zero_division=0,
    )

    return (
        MetricsResult(
            accuracy=acc,
            precision_macro=prec,
            recall_macro=rec,
            f1_macro=f1_mac,
            f1_weighted=f1_weighted,
            labels=labels,
            confusion=np.asarray(cm, dtype=np.int64),
            report_text=str(report),
        ),
        None,
    )


def default_demo_table() -> pd.DataFrame:
    """Exemplo didático independente dos visitantes cadastrados no sistema."""
    return pd.DataFrame(
        {
            "rotulo_verdade": ["Ana", "Ana", "Bruno", "Bruno", "Carlos", "Carlos", "Carlos"],
            "rotulo_previsto": ["Ana", "Bruno", "Bruno", "Bruno", "Carlos", "Ana", "Carlos"],
        }
    )

