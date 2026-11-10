"""Write the ESI methodology PDF (esi/downloads/ESI_methodology.pdf).

Builds an HTML document from esi/data/esi.json and prints it to PDF with Playwright (Chromium).
Run from the repository root after build_esi.py:  python esi/code/docs/make_methodology.py
"""
import html, json, subprocess, sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
D = json.loads((ROOT / "data" / "esi.json").read_text())
M = D["meta"]; S = M["sensitivity"]
ind = pd.read_csv(ROOT / "downloads" / "esi_indicators.csv")
sc = pd.read_csv(ROOT / "downloads" / "esi_scores.csv")
e = html.escape

filled = {i["key"]: ind[i["key"] + "_filled"].mean() * 100 for i in M["indicators"]}
cpi_share = (ind.energy_cpi_inflation_score > 0.99).mean() * 100
cpi_max = ind.loc[ind.energy_cpi_inflation.idxmax()]
dimstats = sc[["availability", "accessibility", "affordability", "acceptability", "esi"]].describe().T
countries = sorted(sc.country.unique())
last = sc[sc.year == sc.year.max()].sort_values("esi_rank")

rows_ind = "".join(
    f"<tr><td>{e(i['dim']) if k % 2 == 0 else ''}</td><td>{e(i['label'])}</td><td>{e(i['unit'])}</td>"
    f"<td>{'+' if i['dir'] > 0 else '−'}</td><td>{e(i['source'])}</td><td>{filled[i['key']]:.1f}%</td></tr>"
    for k, i in enumerate(M["indicators"]))
rows_dim = "".join(
    f"<tr><td>{n.capitalize() if n != 'esi' else 'ESI'}</td><td>{r['mean']:.3f}</td><td>{r['std']:.3f}</td>"
    f"<td>{r['min']:.3f}</td><td>{r['50%']:.3f}</td><td>{r['max']:.3f}</td></tr>" for n, r in dimstats.iterrows())
rows_rank = "".join(
    f"<tr><td>{int(r.esi_rank)}</td><td>{e(r.country)}</td><td>{r.esi:.3f}</td><td>{r.availability:.3f}</td>"
    f"<td>{r.accessibility:.3f}</td><td>{r.affordability:.3f}</td><td>{r.acceptability:.3f}</td></tr>"
    for r in last.itertuples())

doc = f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
<style>
@page {{ size: A4; margin: 22mm 20mm 20mm; }}
body {{ font-family: Newsreader, Georgia, serif; font-size: 11pt; line-height: 1.5; color: #161616; }}
h1 {{ font-weight: 400; font-size: 26pt; letter-spacing: -.02em; margin: 0 0 4pt; }}
h2 {{ font-family: Geist, sans-serif; font-size: 12.5pt; font-weight: 600; margin: 20pt 0 6pt; break-after: avoid; }}
h3 {{ font-family: Geist, sans-serif; font-size: 10.5pt; font-weight: 600; margin: 12pt 0 4pt; break-after: avoid; }}
p {{ margin: 0 0 7pt; text-align: justify; }}
.meta {{ font-family: Geist, sans-serif; color: #555; font-size: 9.5pt; margin-bottom: 14pt; }}
.box {{ border: 1px solid #ddd; border-left: 3px solid #161616; background: #f6f6f4; padding: 9pt 12pt; margin: 10pt 0 14pt; font-size: 10pt; }}
.box p {{ margin: 0 0 5pt; text-align: left; }}
table {{ width: 100%; border-collapse: collapse; font-family: Geist, sans-serif; font-size: 8.4pt; margin: 6pt 0 10pt; break-inside: avoid; }}
th, td {{ border-bottom: 1px solid #e3e3e0; padding: 3.5pt 5pt; text-align: left; vertical-align: top; }}
th {{ color: #666; font-weight: 500; border-bottom: 1px solid #bbb; }}
td.n, th.n {{ text-align: right; font-variant-numeric: tabular-nums; }}
.eq {{ text-align: center; margin: 8pt 0 10pt; font-size: 12pt; }}
.cap {{ font-family: Geist, sans-serif; font-size: 8.5pt; color: #555; margin-top: -4pt; }}
ul {{ margin: 0 0 8pt; padding-left: 16pt; }} li {{ margin-bottom: 3pt; }}
.small {{ font-size: 9.5pt; }}
.ref p {{ padding-left: 18pt; text-indent: -18pt; text-align: left; font-size: 9.8pt; }}
</style></head><body>

<h1>Energy Security Index (ESI)</h1>
<div class="meta">Methodology and data documentation · Version {e(M['version'])}, {e(M['released'])} · Priyanshu Chavda, Department of Economics, Pandit Deendayal Energy University · priyanshu-econ.github.io/esi</div>

<div class="box">
<p><b>Citation required.</b> Anyone who uses the index, its scores, its figures or its processed data must cite both works below. The data are released under the Creative Commons Attribution 4.0 International licence (CC BY 4.0), which makes attribution a legal condition of use.</p>
<p>{e(M['cite_paper'])}</p>
<p>{e(M['cite_data'])}</p>
</div>

<h2>1. Purpose and scope</h2>
<p>The Energy Security Index (ESI) measures how secure a country's energy system is, on a scale from 0 to 1, for 40 countries over 2000–2024 (a balanced panel of 1,000 country-years). It was constructed for the author's job market paper, where it is the dependent variable in quantile, IV-GMM and logit models of the drivers of energy security, and is released here so that others can use it. This document records every construction choice and the reason for it, following the ten-step guidance of the OECD and JRC handbook on composite indicators (OECD, 2008).</p>

<h2>2. Conceptual framework: the four As</h2>
<p>The index follows the widely used 4-A framework (APERC, 2007; Kruyt et al., 2009; Ang et al., 2015), which treats energy security as having four dimensions:</p>
<ul>
<li><b>Availability</b>: whether enough energy is physically available, and how much of it is produced at home.</li>
<li><b>Accessibility</b>: whether people and firms can actually reach that energy through reliable networks.</li>
<li><b>Affordability</b>: whether energy can be paid for, given its price and households' purchasing power.</li>
<li><b>Acceptability</b>: whether energy is used in an environmentally sustainable and efficient way.</li>
</ul>
<p>Each dimension is measured by two indicators, eight in total. The framework has known limits, notably that it says little about how quickly an energy system recovers from a shock (Cherp &amp; Jewell, 2014), but it remains the most common basis for cross-country energy security indices.</p>

<h2>3. Countries and period</h2>
<p>The sample is 40 economies chosen for data coverage across all eight indicators and the explanatory variables of the paper: {e(', '.join(countries))}. The period is 2000–2024, the longest span for which all indicators are available for every country.</p>

<h2>4. Indicators and sources</h2>
<table><tr><th>Dimension</th><th>Indicator</th><th>Unit</th><th>Dir.</th><th>Source</th><th class="n">Filled</th></tr>{rows_ind}</table>
<p class="cap">Dir.: + means a higher value is more secure, − means a lower value is more secure. Filled: share of the 1,000 country-years with no value in the source file.</p>
<p>Energy self-sufficiency is total primary energy production divided by total primary energy consumption, both in quadrillion Btu from the EIA. Energy CPI inflation is the annual percentage change of the energy component of the consumer price index. GDP per capita growth enters Affordability as a proxy for households' ability to pay for energy.</p>

<h3>Missing values</h3>
<p>All raw values were taken from the source files and matched to countries by ISO 3166 code. Where a source had no value for a country-year (in total {S['filled_share']}% of indicator values), the gap was filled by linear interpolation between observed years, or, at the start or end of a series, by carrying the nearest observed value forward or back. Every filled value is flagged in the data (variables ending in <i>_filled</i>), so users can drop or re-impute them.</p>

<h2>5. Normalisation: pooled min–max</h2>
<p>The eight indicators are measured in different units, so each is rescaled to a common 0–1 scale with the min–max method. Indicators where a higher value means more security use Eq. (1); indicators where a lower value means more security use Eq. (2), so that 1 is always the most secure value:</p>
<p class="eq">p<sub>it</sub> = (x<sub>it</sub> − min x) / (max x − min x) &nbsp;&nbsp;(1) &nbsp;&nbsp;&nbsp;&nbsp; p<sub>it</sub> = (max x − x<sub>it</sub>) / (max x − min x) &nbsp;&nbsp;(2)</p>
<p><b>Why min–max.</b> It gives bounded, non-negative scores, which the geometric aggregation in Section 7 requires (z-scores can be negative and cannot enter a geometric mean). It keeps the relative distances between observations, and it is the method used in established indices such as the Human Development Index (UNDP, 2025).</p>
<p><b>Why pooled.</b> The minimum and maximum are taken over all countries and all years together, not year by year. A score of 0.6 therefore means the same thing in 2000 and in 2024, and changes over time reflect real changes in the indicators rather than changes in the yearly best and worst performers.</p>
<p><b>What it implies.</b> Scores are relative to this sample: 1 is the best value observed among these 40 countries over 2000–2024, not an absolute target, and adding countries or years would change the scores. Min–max is also sensitive to extreme values. The clearest case is energy CPI inflation, whose maximum is Venezuela's hyperinflation in {int(cpi_max.year)} ({cpi_max.energy_cpi_inflation:,.0f}%); as a result {cpi_share:.1f}% of country-years score above 0.99 on this indicator, and differences in Affordability come mainly from GDP per capita growth.</p>

<h2>6. Weighting: equal weights</h2>
<p>Each of the four dimensions receives a weight of 0.25, and the two indicators within each dimension receive 0.5 each, so every indicator carries an overall weight of 0.125 (12.5%). Equal weighting is the standard choice when neither theory nor evidence gives a clear reason to rank one dimension above another (OECD, 2008), and it keeps the index transparent. Section 8 shows how much the results depend on this choice.</p>

<h2>7. Aggregation: arithmetic within, geometric across</h2>
<p>The score of dimension d for country i in year t is the arithmetic mean of its two normalised indicators, and the ESI is the geometric mean of the four dimension scores:</p>
<p class="eq">D<sub>dit</sub> = ½ (p<sub>it</sub><sup>(d,1)</sup> + p<sub>it</sub><sup>(d,2)</sup>), &nbsp;&nbsp;&nbsp; ESI<sub>it</sub> = (D<sub>Avail</sub> · D<sub>Access</sub> · D<sub>Afford</sub> · D<sub>Accept</sub>)<sup>1/4</sup> &nbsp;&nbsp;(3)</p>
<p><b>Why this combination.</b> Within a dimension the two indicators measure the same aspect of security, so letting them offset each other is reasonable. Across dimensions, full offsetting is not: a country with plentiful but unaffordable energy is not secure. The geometric mean limits this compensation, because a low score in one dimension pulls the whole index down and can only be partly offset by high scores elsewhere (OECD, 2008; Chentouf &amp; Allouch, 2022). The index therefore rewards balanced energy systems. A dimension score of exactly zero would set the ESI to zero; no dimension reaches zero in this sample (the lowest is {dimstats.loc['availability','min']:.3f}, for Availability).</p>

<table><tr><th>Score</th><th class="n">Mean</th><th class="n">SD</th><th class="n">Min</th><th class="n">Median</th><th class="n">Max</th></tr>{rows_dim}</table>
<p class="cap">Distribution over all 1,000 country-years. Availability is the lowest and most dispersed dimension, so it drives much of the cross-country variation in the ESI.</p>

<h2>8. Sensitivity and robustness</h2>
<p><b>Weights.</b> The ESI was recomputed 1,000 times with random dimension weights (drawn uniformly and rescaled to sum to one; random seed 123). The mean of the simulated index is {S['mc_mean']:.3f} against {S['base_mean']:.3f} for the baseline. Across all country-years the average country moves {S['shift_mean']:.2f} places in the yearly ranking (standard deviation {S['shift_sd']:.2f}, at most {S['shift_max']} places), so the rankings do not hinge on equal weighting. The 5th–95th percentile range of the simulated index is reported for every country-year in the sensitivity file and shown as a band on the website.</p>
<p><b>Aggregation.</b> An arithmetic mean of the four dimensions correlates {S['pearson_arith']:.2f} with the geometric ESI (Spearman rank correlation {S['spearman_arith']:.2f}). The difference is expected: the arithmetic mean lets strong Accessibility and Affordability scores offset weak Availability, which is precisely the compensation the geometric mean is designed to limit. With z-score normalisation in place of min–max (each dimension rescaled to [0, 1] before the geometric mean), the index correlates {S['pearson_z']:.2f} with the baseline (Spearman {S['spearman_z']:.2f}). With weights taken from a principal component analysis of the four dimensions, the correlation is {S['pearson_pca']:.2f} (Spearman {S['spearman_pca']:.2f}).</p>

<h2>9. Energy security in {int(sc.year.max())}</h2>
<table style="break-inside:auto"><tr><th class="n">Rank</th><th>Country</th><th class="n">ESI</th><th class="n">Avail.</th><th class="n">Access.</th><th class="n">Afford.</th><th class="n">Accept.</th></tr>{rows_rank}</table>

<h2>10. Files, code and licence</h2>
<ul class="small">
<li><b>ESI_dataset_v{e(M['version'])}.xlsx</b>: read me, scores, indicators, sensitivity and codebook in one workbook.</li>
<li><b>esi_scores.csv</b>: ESI, four dimensions and yearly ranks. <b>esi_indicators.csv</b>: raw values, 0–1 scores and fill flags for the eight indicators. <b>esi_sensitivity.csv</b>: arithmetic aggregation and the random-weights mean, 5th and 95th percentiles. <b>esi_codebook.csv</b>: definition, unit, direction and source of every variable.</li>
<li><b>Code</b>: <i>esi/code/build_esi.py</i> in the GitHub repository Priyanshu-econ/priyanshu-econ.github.io rebuilds the index and every file from the raw indicators in <i>esi_inputs.csv</i>.</li>
<li><b>Licence</b>: CC BY 4.0 for the index and processed data. The raw indicators remain under their sources' terms: World Bank WDI and Global Database of Inflation (CC BY 4.0), Our World in Data (CC BY 4.0), U.S. EIA (public domain). Please credit those sources when you use the raw values.</li>
<li><b>Versions</b>: {e(M['version'])} ({e(M['released'])}), first public release. Any later revision will keep earlier versions available, so results can be reproduced with the version cited.</li>
</ul>

<h2>References</h2>
<div class="ref">
<p>Ang, B. W., Choong, W. L., &amp; Ng, T. S. (2015). Energy security: Definitions, dimensions and indexes. <i>Renewable and Sustainable Energy Reviews</i>, 42, 1077–1093.</p>
<p>APERC. (2007). <i>A quest for energy security in the 21st century: Resources and constraints</i>. Asia Pacific Energy Research Centre, Institute of Energy Economics, Japan.</p>
<p>Chentouf, M., &amp; Allouch, M. (2022). Environmental energy security in the MENA region: An aggregated composite index. <i>Environment, Development and Sustainability</i>, 24(9), 10945–10974.</p>
<p>Cherp, A., &amp; Jewell, J. (2014). The concept of energy security: Beyond the four As. <i>Energy Policy</i>, 75, 415–421.</p>
<p>Kruyt, B., van Vuuren, D. P., de Vries, H. J. M., &amp; Groenenberg, H. (2009). Indicators for energy security. <i>Energy Policy</i>, 37(6), 2166–2181.</p>
<p>OECD. (2008). <i>Handbook on constructing composite indicators: Methodology and user guide</i>. OECD Publishing.</p>
<p>UNDP. (2025). <i>Human development report 2025</i>. United Nations Development Programme.</p>
</div>
</body></html>"""

out_html = ROOT / "code" / "docs" / "methodology.html"
out_html.write_text(doc, encoding="utf-8")
js = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://{out_html}', {{ waitUntil: 'networkidle' }});
  await p.pdf({{ path: '{ROOT / "downloads" / "ESI_methodology.pdf"}', format: 'A4', printBackground: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font:8px sans-serif;color:#888;width:100%;padding:0 20mm;display:flex;justify-content:space-between"><span>Energy Security Index v{M["version"]} · Methodology · Chavda (2026)</span><span class=pageNumber></span></div>',
    margin: {{ top: '22mm', bottom: '20mm', left: '20mm', right: '20mm' }} }});
  await b.close();
}})();"""
subprocess.run(["node", "-e", js], check=True)
print("wrote", ROOT / "downloads" / "ESI_methodology.pdf")
