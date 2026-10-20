// Codon usage analysis: codon frequency, RSCU, CAI and Random Forest HEG/LEG prediction.
// Everything runs in the browser.

// ---------- Genetic code ----------
const BASES = "TCAG";
const AA_STRING = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
const CODON_TO_AA = {};
const ALL_CODONS = [];
{
  let i = 0;
  for (const a of BASES) for (const b of BASES) for (const c of BASES) {
    const codon = a + b + c;
    CODON_TO_AA[codon] = AA_STRING[i++];
    ALL_CODONS.push(codon);
  }
}
const AA_NAMES = {
  A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile",
  L: "Leu", K: "Lys", M: "Met", F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop",
};
// Synonymous codon families (amino acid -> codons)
const FAMILIES = {};
for (const codon of ALL_CODONS) (FAMILIES[CODON_TO_AA[codon]] ||= []).push(codon);
// Codons that carry information about bias: amino acids with >1 codon, no stops (59 codons)
const RSCU_CODONS = ALL_CODONS.filter(c => CODON_TO_AA[c] !== "*" && FAMILIES[CODON_TO_AA[c]].length > 1);

// ---------- CAI reference: E. coli relative adaptiveness (w), Sharp & Li 1987 ----------
const W_ECOLI = {
  TTT: 0.296, TTC: 1.000,
  TTA: 0.020, TTG: 0.020, CTT: 0.042, CTC: 0.037, CTA: 0.007, CTG: 1.000,
  ATT: 0.185, ATC: 1.000, ATA: 0.003,
  GTT: 1.000, GTC: 0.066, GTA: 0.495, GTG: 0.221,
  TCT: 1.000, TCC: 0.744, TCA: 0.077, TCG: 0.017, AGT: 0.085, AGC: 0.410,
  CCT: 0.070, CCC: 0.012, CCA: 0.135, CCG: 1.000,
  ACT: 0.965, ACC: 1.000, ACA: 0.076, ACG: 0.099,
  GCT: 1.000, GCC: 0.122, GCA: 0.586, GCG: 0.424,
  TAT: 0.239, TAC: 1.000,
  CAT: 0.291, CAC: 1.000,
  CAA: 0.124, CAG: 1.000,
  AAT: 0.051, AAC: 1.000,
  AAA: 1.000, AAG: 0.253,
  GAT: 0.434, GAC: 1.000,
  GAA: 1.000, GAG: 0.259,
  TGT: 0.500, TGC: 1.000,
  CGT: 1.000, CGC: 0.356, CGA: 0.004, CGG: 0.004, AGA: 0.004, AGG: 0.002,
  GGT: 1.000, GGC: 0.724, GGA: 0.010, GGG: 0.019,
};
const OPTIMAL = new Set(Object.keys(W_ECOLI).filter(c => W_ECOLI[c] === 1));


// ---------- Parsing ----------
function parseInput(text) {
  text = text.trim();
  if (!text) return [];
  const records = [];
  if (text.startsWith(">")) {
    for (const block of text.split(/^>/m).filter(Boolean)) {
      const lines = block.split(/\r?\n/);
      records.push({ name: lines[0].trim() || `Sequence ${records.length + 1}`, raw: lines.slice(1).join("") });
    }
  } else {
    records.push({ name: "Sequence 1", raw: text });
  }
  return records.map(r => {
    const upper = r.raw.toUpperCase().replace(/U/g, "T").replace(/[\s\d]/g, "");
    const invalid = upper.replace(/[ACGT]/g, "").length;
    return { name: r.name, seq: upper.replace(/[^ACGT]/g, ""), invalid };
  });
}

// ---------- Analysis ----------
function analyze(name, seq) {
  const counts = Object.fromEntries(ALL_CODONS.map(c => [c, 0]));
  const usable = seq.length - (seq.length % 3);
  for (let i = 0; i < usable; i += 3) counts[seq.slice(i, i + 3)]++;
  const total = usable / 3;

  // Frequency (per codon, over all codons)
  const freq = {};
  for (const c of ALL_CODONS) freq[c] = total ? counts[c] / total : 0;

  // RSCU
  const rscu = {};
  for (const [aa, fam] of Object.entries(FAMILIES)) {
    const sum = fam.reduce((s, c) => s + counts[c], 0);
    for (const c of fam) rscu[c] = sum ? counts[c] * fam.length / sum : 0;
  }

  // CAI (geometric mean of w; skip Met, Trp and stops)
  let logSum = 0, n = 0;
  for (const c of ALL_CODONS) {
    if (!(c in W_ECOLI) || !counts[c]) continue;
    logSum += counts[c] * Math.log(W_ECOLI[c]);
    n += counts[c];
  }
  const cai = n ? Math.exp(logSum / n) : NaN;

  // GC content
  let gc = 0, gc3 = 0;
  for (let i = 0; i < usable; i++) if (seq[i] === "G" || seq[i] === "C") gc++;
  for (let i = 2; i < usable; i += 3) if (seq[i] === "G" || seq[i] === "C") gc3++;

  return {
    name, total, counts, freq, rscu, cai,
    gc: usable ? gc / usable : 0,
    gc3: total ? gc3 / total : 0,
    leftover: seq.length % 3,
  };
}

// Feature vector for the Random Forest: 64 codon frequencies + 59 RSCU values
const FEATURE_NAMES = [...ALL_CODONS.map(c => ({ kind: "Frequency", codon: c })), ...RSCU_CODONS.map(c => ({ kind: "RSCU", codon: c }))];
const featureVector = r => [...ALL_CODONS.map(c => r.freq[c]), ...RSCU_CODONS.map(c => r.rscu[c])];

// The Random Forest trained with scikit-learn (notebook/kodon_model.ipynb), loaded from model-data.js.
// Each tree is stored as arrays: split feature f, threshold t, children l / r, leaf probability p.
function treeProba(tree, x) {
  let node = 0;
  // scikit-learn compares features as 32-bit floats, so round the same way
  while (tree.f[node] !== -1) node = Math.fround(x[tree.f[node]]) <= tree.t[node] ? tree.l[node] : tree.r[node];
  return tree.p[node];
}
const forestProba = x => KODON_MODEL.trees.reduce((s, tree) => s + treeProba(tree, x), 0) / KODON_MODEL.trees.length;

function predict(r) {
  if (!r.total) return { label: "—", cls: "", text: "Not enough codons", p: NaN };
  const p = forestProba(featureVector(r));
  return p >= 0.5
    ? { label: "HEG", cls: "heg", text: `Highly expressed · P(HEG) = ${p.toFixed(2)}`, p }
    : { label: "LEG", cls: "leg", text: `Lowly expressed · P(HEG) = ${p.toFixed(2)}`, p };
}

// ---------- Rendering ----------
const $ = id => document.getElementById(id);
let results = [];

function pct(x) { return (x * 100).toFixed(1); }

function showDetail(r) {
  $("detailName").textContent = r.name;
  $("pred").textContent = r.prediction.label;
  $("predSub").textContent = r.prediction.text;
  $("predCard").className = "stat pred " + r.prediction.cls;
  $("cai").textContent = Number.isNaN(r.cai) ? "—" : r.cai.toFixed(3);
  $("len").textContent = r.total;
  $("lenSub").textContent = r.leftover ? `${r.leftover} trailing base(s) ignored` : "complete codons";
  $("gc").textContent = `${pct(r.gc)} / ${pct(r.gc3)}`;

  const chart = $("chart");
  chart.innerHTML = "";
  const maxR = Math.max(...RSCU_CODONS.map(c => FAMILIES[CODON_TO_AA[c]].length)); // 6
  const aas = [...new Set(RSCU_CODONS.map(c => CODON_TO_AA[c]))].sort((a, b) => AA_NAMES[a].localeCompare(AA_NAMES[b]));
  for (const aa of aas) {
    const g = document.createElement("div");
    g.className = "aa-group";
    const fam = FAMILIES[aa];
    const used = fam.reduce((s, c) => s + r.counts[c], 0);
    g.innerHTML = `<h5>${AA_NAMES[aa]} <span>(${aa}, n=${used})</span></h5>`;
    for (const c of fam) {
      const v = r.rscu[c];
      const row = document.createElement("div");
      row.className = "bar-row";
      row.title = `${c}: count ${r.counts[c]}, RSCU ${v.toFixed(2)}`;
      row.innerHTML = `<span>${c}</span><div class="bar-track"><div class="bar ${OPTIMAL.has(c) ? "opt" : ""}" style="width:${Math.min(100, (v / maxR) * 100)}%"></div></div><span class="bar-val">${v.toFixed(2)}</span>`;
      g.appendChild(row);
    }
    chart.appendChild(g);
  }
}

function render() {
  $("results").hidden = results.length === 0;
  if (!results.length) return;
  const tbody = $("batch").querySelector("tbody");
  tbody.innerHTML = "";
  $("batchWrap").hidden = results.length < 2;
  results.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td></td><td>${r.total}</td><td>${pct(r.gc)}</td><td>${pct(r.gc3)}</td><td>${Number.isNaN(r.cai) ? "—" : r.cai.toFixed(3)}</td><td>${Number.isNaN(r.prediction.p) ? "—" : r.prediction.p.toFixed(2)}</td><td class="tag ${r.prediction.cls}">${r.prediction.label}</td>`;
    tr.firstChild.textContent = r.name;
    tr.addEventListener("click", () => {
      tbody.querySelectorAll("tr").forEach(x => x.classList.remove("sel"));
      tr.classList.add("sel");
      showDetail(r);
      $("detail").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    if (i === 0) tr.classList.add("sel");
    tbody.appendChild(tr);
  });
  showDetail(results[0]);
}

function run() {
  const msg = $("msg");
  msg.className = "msg";
  const records = parseInput($("seq").value);
  if (!records.length) { msg.textContent = "Please paste a DNA sequence first."; results = []; render(); return; }
  const tooShort = records.filter(r => r.seq.length < 3);
  results = records.filter(r => r.seq.length >= 3).map(r => analyze(r.name, r.seq));
  for (const r of results) r.prediction = predict(r);
  const notes = [];
  const invalid = records.reduce((s, r) => s + r.invalid, 0);
  if (invalid) notes.push(`${invalid} non-ACGT character(s) were removed.`);
  if (tooShort.length) notes.push(`${tooShort.length} sequence(s) were too short and skipped.`);
  const brief = results.filter(r => r.total < 100).length;
  if (brief) notes.push(`${brief} sequence(s) have fewer than 100 codons, so the prediction is less reliable.`);
  if (!results.length) { msg.textContent = "No valid sequence found."; render(); return; }
  msg.className = "msg ok";
  msg.textContent = `Analyzed ${results.length} sequence(s). ${notes.join(" ")}`;
  render();
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function downloadCsv() {
  const header = ["gene", "codons", "gc", "gc3", "cai", "p_heg", "prediction",
    ...ALL_CODONS.map(c => `freq_${c}`), ...RSCU_CODONS.map(c => `rscu_${c}`)];
  const esc = s => `"${String(s).replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const r of results) {
    lines.push([esc(r.name), r.total, r.gc.toFixed(4), r.gc3.toFixed(4), Number.isNaN(r.cai) ? "" : r.cai.toFixed(4),
      Number.isNaN(r.prediction.p) ? "" : r.prediction.p.toFixed(4), r.prediction.label,
      ...ALL_CODONS.map(c => r.freq[c].toFixed(5)), ...RSCU_CODONS.map(c => r.rscu[c].toFixed(4))].join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "codon_features.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Example sequences (GFP protein back-translated two ways) ----------
const GFP = "MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTFSYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITHGMDELYK";

function backTranslate(protein, pick) {
  const seen = {};
  let dna = "";
  for (const aa of protein) {
    const fam = FAMILIES[aa];
    seen[aa] = (seen[aa] || 0) + 1;
    dna += pick(fam, seen[aa]);
  }
  return dna + "TAA";
}
const optimalPick = fam => fam.find(c => OPTIMAL.has(c)) || fam[0];

function wrap60(s) { return s.match(/.{1,60}/g).join("\n"); }

// ---------- Events ----------
$("run").addEventListener("click", run);
$("demoHeg").addEventListener("click", () => {
  $("seq").value = ">GFP_optimal_codons\n" + wrap60(backTranslate(GFP, optimalPick));
  run();
});
$("demoLeg").addEventListener("click", () => {
  // Held-out NCBI genes the model never saw during training: 4 HEG + 4 LEG
  const pick = label => testGenes.filter(g => g[2] === label).slice(0, 4);
  const genes = [...pick("HEG"), ...pick("LEG")];
  $("seq").value = genes.map(g => `>${g[0]} ${g[1]} (known ${g[2]}: ${g[3]})\n${wrap60(g[4])}`).join("\n");
  run();
});

// ---------- Model results (computed in Python, see notebook/kodon_model.ipynb) ----------
const testGenes = KODON_MODEL.testGenes;

function renderModel() {
  const m = KODON_MODEL.metrics;
  document.querySelectorAll("[data-k]").forEach(el => { el.textContent = KODON_MODEL[el.dataset.k]; });
  const f = x => (x * 100).toFixed(1) + "%";
  $("mAcc").textContent = f(m.accuracy);
  $("mF1").textContent = m.f1.toFixed(3);
  $("mPrec").textContent = f(m.precision);
  $("mRec").textContent = f(m.recall);
  $("mCai").textContent = f(KODON_MODEL.caiAccuracy);
  $("mCv").textContent = `${f(KODON_MODEL.cvAccuracy[0])} ± ${(KODON_MODEL.cvAccuracy[1] * 100).toFixed(1)}`;
  $("mSplit").textContent = `Trained on ${KODON_MODEL.nTrain} genes, tested on ${KODON_MODEL.nTest} separate genes · ${KODON_MODEL.trees.length} trees · ${KODON_MODEL.trainedWith}`;
  $("cmTP").textContent = m.tp; $("cmFN").textContent = m.fn;
  $("cmFP").textContent = m.fp; $("cmTN").textContent = m.tn;

  const top = KODON_MODEL.importance.map((v, i) => ({ v, ...FEATURE_NAMES[i] }))
    .sort((a, b) => b.v - a.v).slice(0, 15);
  const max = top[0].v;
  $("importance").innerHTML = top.map(t => {
    const aa = CODON_TO_AA[t.codon];
    return `<div class="imp-row"><span class="imp-name"><b>${t.codon}</b> ${AA_NAMES[aa]} · ${t.kind}</span>` +
      `<div class="bar-track"><div class="bar ${OPTIMAL.has(t.codon) ? "opt" : ""}" style="width:${(t.v / max) * 100}%"></div></div>` +
      `<span class="bar-val">${(t.v * 100).toFixed(1)}%</span></div>`;
  }).join("");
}

renderModel();
$("clear").addEventListener("click", () => { $("seq").value = ""; $("msg").textContent = ""; results = []; render(); });
$("csv").addEventListener("click", downloadCsv);
$("file").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { $("seq").value = reader.result; run(); };
  reader.readAsText(f);
  e.target.value = "";
});
