# PXL Web NetSim • Strikte Samenwerkingsregels voor AI-Agents & Ontwikkelaars
*Dit bestand (`AGENTS.md`) definieert het verplichte samenwerkings- en synchronisatieprotocol voor ALLE AI-agents (Antigravity, GitHub Copilot, Claude, Cursor, ChatGPT) en menselijke ontwikkelaars die aan deze repository werken.*

---

## 🔒 1. Verplicht Concurrency Protocol (LOCK Systeem)

Om te voorkomen dat meerdere ontwikkelaars of AI-agents gelijktijdig aan de code werken en merge conflicts of contextverlies veroorzaken, hanteert dit project een verplicht vergrendelingsmechanisme via `.ai-sync/LOCK.json`.

### 🚦 Vóór het starten van ELKE taak:
1. **Voer altijd eerst `git pull` uit** om de meest recente status van `main` binnen te halen.
2. **Lees `.ai-sync/LOCK.json`:**
   * **Is `"status": "LOCKED"`?**  
     🛑 **STOP ONMIDDELLIJK MET WERKEN!**  
     Breng de gebruiker op de hoogte:
     > *"⚠️ Het project is momenteel vergrendeld door **[locked_by]** sinds **[started_at]**. Er wordt gewerkt aan: **[working_on]**. Wacht tot deze taak is afgerond en vrijgegeven alvorens wijzigingen aan te brengen."*  
     Wijzig GEEN bestanden!
   * **Is `"status": "FREE"`?**  
     ✅ Vergrendel het project direct door `.ai-sync/LOCK.json` bij te werken:
     ```json
     {
       "status": "LOCKED",
       "locked_by": "Naam Ontwikkelaar / AI Agent (bv. David - Antigravity)",
       "started_at": "YYYY-MM-DDTHH:MM:SSZ",
       "working_on": "Korte omschrijving van de taak die nu gestart wordt",
       "message": "Project is momenteel vergrendeld. Wacht tot deze taak is afgerond."
     }
     ```
     Voer direct de vergrendeling uit naar GitHub:
     ```bash
     git add .ai-sync/LOCK.json
     git commit -m "chore: lock project for [korte omschrijving]"
     git push origin main
     ```
3. **Lees `.ai-sync/CONTEXT_LOG.md`:**  
   Neem de bovenste (meest recente) log-entry door om direct volledig op de hoogte te zijn van de architectuur, recente beslissingen en huidige status.

---

## 🏁 2. Afrondingsprotocol (Release & Documentatie)

Zodra een taak is voltooid of wanneer de gebruiker vraagt om de sessie af te ronden:

1. **Documenteer in `.ai-sync/CONTEXT_LOG.md`:**  
   Voeg **bovenaan** (vlak onder de titel) een nieuwe gestructureerde log-entry toe:
   * **Datum & Tijdstip:** ISO of lokale timestamp.
   * **Ontwikkelaar & AI-tool:** Naam en gebruikte assistant.
   * **Gewijzigde/Nieuwe Bestanden:** Overzicht van aangepaste modules.
   * **Toegepaste Logica & Keuzes:** Waarom zijn bepaalde keuzes gemaakt? Welke patronen zijn gebruikt?
   * **Openstaande Punten / Volgende Stappen:** Wat moet er eventueel nog gebeuren?
2. **Zet `.ai-sync/LOCK.json` terug op `FREE`:**
   ```json
   {
     "status": "FREE",
     "locked_by": null,
     "started_at": null,
     "working_on": null,
     "message": "Vrij om aan te werken. Voer eerst git pull uit."
   }
   ```
3. **Commit en Push naar GitHub:**
   ```bash
   git add .
   git commit -m "feat/fix/docs: Duidelijke beschrijving van de voltooide taak"
   git push origin main
   ```

---

## 📐 3. Kernrichtlijnen voor Code & Architectuur

* **Zero-Dependency Frontend:** Geen npm/Node.js dependencies toevoegen aan de frontend tenzij expliciet goedgekeurd. Pure modular vanilla JavaScript, CSS3 en HTML5 Canvas.
* **Behoud Bestaande Functionaliteit & Comments:** Verwijder nooit bestaande comments, docstrings of architectuurpatronen.
* **Productieveiligheid:** Wijzig geen productie-sleutels of database-schema's zonder backward-compatibility migraties in `backend/database.py`.
* **Tests:** Voer bij substantiële wijzigingen altijd de geautomatiseerde tests uit in `tests/`.
