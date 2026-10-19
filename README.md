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

1. **Biopython** downloads all 4,318 coding sequences of *E. coli* K-12 MG1655 from NCBI (RefSeq NC_000913.3); duplicate records of the same gene are removed
2. Genes are labelled from NCBI annotation:
   - **104 HEG**: ribosomal proteins (excluding the alternative paralogs ykgM / ykgO), translation factors, chaperones, major outer-membrane proteins, glycolysis, TCA and ATP-synthase genes
   - **104 LEG**: DNA-binding transcriptional regulators, excluding highly expressed global regulators (Crp, Fis, H-NS, Lrp, Fnr, ArcA, OmpR, Cra, StpA, Nac, Fur, IHF), evenly sampled from 252 candidates
3. **pandas** builds the 123 codon features per gene
4. **Train / test split**: `StratifiedGroupKFold` holds out 25% of the genes as a test set (156 train / 52 test, balanced HEG / LEG). Near-identical gene copies (e.g. *tufA* / *tufB*) are grouped so they never end up on both sides, and the notebook checks that no gene or overlapping sequence is shared
5. **scikit-learn** trains a `RandomForestClassifier` (200 trees) on the training set only and evaluates it on the unseen test set: accuracy, precision, recall, F1, confusion matrix, grouped 5-fold cross-validation and a CAI baseline
6. **matplotlib / seaborn** plot the confusion matrix and the most important codons
7. The trained trees are exported to `model-data.js`, which the website runs in the browser, so the site's predictions are exactly the scikit-learn model's predictions

### Results (52 held-out test genes)

| Metric | Value |
|---|---|
| Accuracy | 98.1% |
| F1-score | 0.980 |
| Precision / Recall (HEG) | 100% / 96.2% |
| Grouped 5-fold cross-validation accuracy | 95.7% ± 2.8% |
| CAI rule (CAI ≥ 0.50 = HEG), same test genes | 98.1% |

The cross-validation score averages five different train / test splits, so it is the more reliable estimate.

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
| `data/kodon_dataset.csv` | The 208 labelled genes with all 123 features and their train / test split |
| `model-data.js` | Trained scikit-learn forest, exported by the notebook |
| `index.html` | Page content (opening, analyzer, how it works, model results) |
| `style.css` | Look and colours |
| `app.js` | Feature calculation in the browser and prediction with the exported forest |
| `intro.js` | Cinematic opening (film, drifting mist, grain, scroll fly-through), scroll reveals and analyzer transition |

Made by Ritu Ramesh.

## License

The code is released under the [MIT License](LICENSE). The opening film is not part of this repository and stays under its own Pexels license (see below).

Opening film: ["A foggy forest with trees and fog" on Pexels](https://www.pexels.com/video/a-foggy-forest-with-trees-and-fog-17428163/) (free Pexels License), streamed from videos.pexels.com.
