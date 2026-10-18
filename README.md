# Kodon

**Machine Learning-Based Analysis of Codon Usage Bias to Distinguish Highly and Lowly Expressed Genes in Prokaryotes**

Live site: https://ritu-ramesh-dev.github.io/kodon/

Paste an E. coli coding sequence (or upload a FASTA file) and Kodon calculates

- codon frequency (64 values)
- RSCU, relative synonymous codon usage (59 values)
- GC and GC3 content
- CAI, the Codon Adaptation Index (E. coli reference weights, Sharp & Li 1987)

and a Random Forest trained in Python with scikit-learn predicts whether the gene is highly (HEG) or lowly (LEG) expressed.

## The Python pipeline

[`notebook/kodon_model.ipynb`](notebook/kodon_model.ipynb) does everything end to end:

1. **Biopython** downloads all 4,318 coding sequences of *E. coli* K-12 MG1655 from NCBI (RefSeq NC_000913.3)
2. Genes are labelled from NCBI annotation:
   - **107 HEG**: ribosomal proteins (excluding the alternative paralogs ykgM / ykgO), translation factors, chaperones, major outer-membrane proteins, glycolysis, TCA and ATP-synthase genes
   - **107 LEG**: DNA-binding transcriptional regulators, excluding highly expressed global regulators (Crp, Fis, H-NS, Lrp, Fnr, ArcA, OmpR, Cra, StpA, Nac, Fur, IHF), evenly sampled from 252 candidates
3. **pandas** builds the 123 codon features per gene
4. **scikit-learn** trains a `RandomForestClassifier` (200 trees) on a stratified 75% split and tests it on the other 25%
5. Evaluation: accuracy, precision, recall, F1, confusion matrix, 5-fold cross-validation and a CAI baseline
6. **matplotlib / seaborn** plot the confusion matrix and the most important codons
7. The trained trees are exported to `model-data.js`, which the website runs in the browser, so the site's predictions are exactly the scikit-learn model's predictions

### Results (54 held-out test genes)

| Metric | Value |
|---|---|
| Accuracy | 96.3% |
| F1-score | 0.962 |
| Precision / Recall (HEG) | 100% / 92.6% |
| 5-fold cross-validation accuracy | 96.2% ± 2.4% |
| CAI rule (CAI ≥ 0.50 = HEG), same test genes | 94.4% |

### Run it yourself

```bash
pip install -r notebook/requirements.txt
cd notebook
jupyter notebook kodon_model.ipynb
```

In Google Colab, upload the notebook and run `!pip install biopython` first.

## Files

| File | What it is |
|---|---|
| `notebook/kodon_model.ipynb` | Python pipeline: data, features, training, evaluation, export |
| `notebook/requirements.txt` | Python libraries |
| `data/kodon_dataset.csv` | The 214 labelled genes with all 123 features and their train / test split |
| `model-data.js` | Trained scikit-learn forest, exported by the notebook |
| `index.html` | Page content (opening, analyzer, how it works, model results) |
| `style.css` | Look and colours |
| `app.js` | Feature calculation in the browser and prediction with the exported forest |
| `intro.js` | Scroll-down opening and analyzer transition |

Made by Ritu Ramesh.
