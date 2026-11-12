"""
generate_collaboration_guide_pdf.py - Generates the PDF guide for adding the project in Antigravity or VS Code.
Part of PXL Web NetSim (Hogeschool PXL)
"""

import os
import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

html_content = """<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <title>PXL Web NetSim • Handleiding Samenwerken</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 15mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      font-size: 11pt;
      margin: 0;
      padding: 0;
    }
    .header {
      border-bottom: 3px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-title h1 {
      margin: 0;
      font-size: 22pt;
      color: #0369a1;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header-title p {
      margin: 4px 0 0;
      font-size: 12pt;
      color: #64748b;
      font-weight: 500;
    }
    .badge {
      background: #e0f2fe;
      color: #0369a1;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 9pt;
      font-weight: 700;
      display: inline-block;
    }
    h2 {
      color: #0f172a;
      font-size: 14pt;
      margin-top: 22px;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h3 {
      color: #0369a1;
      font-size: 11.5pt;
      margin-top: 14px;
      margin-bottom: 6px;
    }
    p, li {
      margin: 4px 0;
    }
    ul, ol {
      margin: 6px 0 10px 22px;
      padding: 0;
    }
    code {
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 9.5pt;
      border: 1px solid #cbd5e1;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 14px;
      border-radius: 6px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 9.5pt;
      margin: 8px 0;
      overflow-x: auto;
      line-height: 1.4;
    }
    .callout {
      background: #f8fafc;
      border-left: 4px solid #0284c7;
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      margin: 12px 0;
    }
    .callout-warning {
      background: #fffbeb;
      border-left-color: #f59e0b;
      color: #92400e;
    }
    .callout-success {
      background: #f0fdf4;
      border-left-color: #22c55e;
      color: #166534;
    }
    .step-box {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .step-num {
      display: inline-block;
      width: 22px;
      height: 22px;
      background: #0284c7;
      color: white;
      text-align: center;
      line-height: 22px;
      border-radius: 50%;
      font-weight: bold;
      font-size: 10pt;
      margin-right: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background: #f8fafc;
      color: #334155;
      font-weight: 700;
    }
    .footer {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-size: 8.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-title">
      <h1>PXL Web NetSim</h1>
      <p>Handleiding: Veilig Samenwerken met Antigravity &amp; VS Code</p>
    </div>
    <div>
      <span class="badge">Hogeschool PXL • SNE</span>
    </div>
  </div>

  <div class="callout callout-success">
    <strong>Doel van dit systeem:</strong> Samenwerken aan één repository via GitHub zonder merge-conflicten, zonder code-overschrijvingen en met volledig behoud van gedeeld geheugen tussen AI-assistenten (Antigravity en GitHub Copilot).
  </div>

  <h2>1. Project Toevoegen &amp; Starten</h2>

  <div class="step-box">
    <h3><span class="step-num">A</span>In Google Antigravity (Aanbevolen)</h3>
    <ol>
      <li><strong>Installeer Antigravity</strong> (indien nog niet gedaan).</li>
      <li>Open PowerShell of Command Prompt en clone de repository naar je gewenste map:
        <pre>git clone https://github.com/PXLNetworkgroup/pxl-web-netsim.git</pre>
      </li>
      <li>Start Antigravity en kies in het menu: <code>File</code> &rarr; <code>Open Folder...</code>.</li>
      <li>Selecteer de gekloonde map <code>pxl-web-netsim</code>.</li>
      <li>Antigravity leest automatisch <code>AGENTS.md</code> en <code>.ai-sync/CONTEXT_LOG.md</code> in als basisinstructies voor elke sessie!</li>
    </ol>
  </div>

  <div class="step-box">
    <h3><span class="step-num">B</span>In Visual Studio Code (met GitHub Copilot)</h3>
    <ol>
      <li>Open <strong>VS Code</strong>.</li>
      <li>Druk op <code>Ctrl + Shift + P</code> en typ <code>Git: Clone</code>.</li>
      <li>Plak de URL: <code>https://github.com/PXLNetworkgroup/pxl-web-netsim.git</code> en kies een lokale map.</li>
      <li>Klik op <strong>Open Folder</strong> zodra het downloaden klaar is.</li>
      <li>GitHub Copilot pikt automatisch <code>.github/copilot-instructions.md</code> op en volgt hetzelfde protocol.</li>
    </ol>
  </div>

  <h2>2. Het Verplichte Concurrency Protocol (LOCK Systeem)</h2>
  <p>Om te vermijden dat jij en je collega tegelijkertijd aan dezelfde code werken, gebruikt het project een eenvoudige JSON lock in <code>.ai-sync/LOCK.json</code>.</p>

  <div class="step-box">
    <h3>🚦 Vóór het starten van ELKE taak:</h3>
    <ol>
      <li>Voer altijd eerst <code>git pull</code> uit in de terminal:
        <pre>git pull origin main</pre>
      </li>
      <li>Open of inspecteer <code>.ai-sync/LOCK.json</code>:
        <ul>
          <li><strong>Staat <code>"status": "LOCKED"</code>?</strong><br>
            <span style="color: #b91c1c; font-weight: bold;">STOP METEEN!</span> Een collega is momenteel bezig aan de code. Kijk bij <code>"locked_by"</code> wie het is en bij <code>"working_on"</code> waaraan hij werkt. Wacht tot hij klaar is.</li>
          <li><strong>Staat <code>"status": "FREE"</code>?</strong><br>
            <span style="color: #15803d; font-weight: bold;">VRIJ OM TE STARTEN!</span> Zet de status direct op <code>"LOCKED"</code> met jouw naam en taak:
            <pre>{
  "status": "LOCKED",
  "locked_by": "Jouw Naam (Antigravity / VS Code)",
  "started_at": "2026-11-12T12:00:00Z",
  "working_on": "Toevoegen van nieuwe labo's voor Hoofdstuk 6",
  "message": "Project vergrendeld. Wacht tot afronding."
}</pre>
            Commit en push deze lock direct naar GitHub:
            <pre>git add .ai-sync/LOCK.json
git commit -m "chore: lock project for Hoofdstuk 6 labs"
git push origin main</pre>
          </li>
        </ul>
      </li>
      <li>Lees de bovenste entry in <code>.ai-sync/CONTEXT_LOG.md</code>. Hierdoor weet jij (en je AI) exact wat de huidige status, architectuur en gemaakte keuzes zijn!</li>
    </ol>
  </div>

  <div class="step-box">
    <h3>🏁 Na afronden van je taak:</h3>
    <ol>
      <li>Schrijf een beknopte samenvatting <strong>bovenaan</strong> in <code>.ai-sync/CONTEXT_LOG.md</code> (wie, datum, gewijzigde bestanden, wat je hebt gedaan).</li>
      <li>Zet <code>.ai-sync/LOCK.json</code> weer vrij:
        <pre>{
  "status": "FREE",
  "locked_by": null,
  "started_at": null,
  "working_on": null,
  "message": "Vrij om aan te werken. Voer eerst git pull uit."
}</pre>
      </li>
      <li>Commit al je werk en push naar GitHub:
        <pre>git add .
git commit -m "feat: Beschrijving van wat je hebt afgewerkt"
git push origin main</pre>
      </li>
    </ol>
  </div>

  <h2>3. Handige Commando's voor Ontwikkeling</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 35%;">Actie</th>
        <th>Commando</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Lokale server starten</strong></td>
        <td><code>python server.py</code> &rarr; Open <a href="http://localhost:8080">http://localhost:8080</a> in de browser</td>
      </tr>
      <tr>
        <td><strong>Automatische tests uitvoeren</strong></td>
        <td><code>python tests/test_firewall_and_shelf_categories.py</code></td>
      </tr>
      <tr>
        <td><strong>Implementeren naar Google Cloud Run</strong></td>
        <td><code>powershell -ExecutionPolicy Bypass -File .\\deploy_gcloud.ps1</code></td>
      </tr>
    </tbody>
  </table>

  <div class="callout callout-warning">
    <strong>Gouden Regel:</strong> De frontend gebruikt <em>pure vanilla modern JavaScript</em> zonder zware npm dependencies. Wijzigingen in <code>static/</code> zijn direct zichtbaar na een browser refresh!
  </div>

  <div class="footer">
    <span>© Hogeschool PXL • System &amp; Network Engineering</span>
    <span>Document gegenereerd op 12 november 2026</span>
  </div>

</body>
</html>
"""

def generate_pdf():
    pdf_path = os.path.abspath("PXL_NetSim_Samenwerken_Handleiding.pdf")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page()
        page.set_content(html_content, wait_until="networkidle")
        page.pdf(
            path=pdf_path,
            format="A4",
            print_background=True,
            margin={"top": "15mm", "bottom": "15mm", "left": "15mm", "right": "15mm"}
        )
        browser.close()
    print(f"PDF generated successfully at: {pdf_path}")

if __name__ == "__main__":
    generate_pdf()
