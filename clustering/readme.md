# Packages installieren
Stelle sicher, dass du dich im Directory `clustering` befindest.
`npm install`

# JSON mit den embeddings einbetten
https://hsluzern.sharepoint.com/:u:/r/sites/DDA23-TM-13_Act1/Freigegebene%20Dokumente/13_Act%201/DDA23_1_Act1_in/dataSetEmbeddings/embeddings.json.zip?csf=1&web=1&e=5Ewfuo

# Schlüssel für OpenAI generieren 
Ein .env File generieren. Das .env-File ist einfach eine Textdatei, in der du geheime Zugangsdaten (wie den API-Key) ablegst, damit sie nicht direkt im Code stehen. 

Im .env File folgenden Code einkopieren: <br/>
`OPENAI_API_KEY=dein_geheimer_api_schlüssel`

<br/>Du kannst meinen Schlüssel benutzen, der Schlüssel wird beim Ende des Moduls gelöscht. Bitte überlege, ob du wirklich die API beanspruchen willst, die Requests generieren Kosten. Teilt euch Resultate, die andere Gruppen bereits generiert haben (wie Clustering, usw.) auf Teams mit.
<br/>
Meinen Schlüssel findest du auf Teams:
 https://hsluzern.sharepoint.com/:w:/r/sites/DDA23-TM-13_Act1/Freigegebene%20Dokumente/13_Act%201/DDA23_1_Act1_in/dataSetEmbeddings/Key-Hanna.docx?d=wacbfad965b4845a2a1e66eb6ce27df29&csf=1&web=1&e=eSJ7PP

 # Clustering 
 Das Clustern von OpenAi versieht die Daten mit einer Cluster Nummer <br/>
 `"cluster": 9,`
 In Zeile 22 von index.js kannst du angeben, wieviele Cluster du generieren willst. <br/>
 `const k = 20; // Anzahl Cluster (kannst du anpassen)`
<br/>
Über den Node Befehl lässt du dir die Cluster generieren und eine neue json Datei `clustered.json` erstellen. <br/>
`node index.js` <br/>
 
# Titel/Beschreibung für die Cluster generieren
 Möchtest du zusätzlich zu den Nummern noch Titel generieren, kannst du das mit ChatGPT versuchen. OpenAI bietet einen Zugriff auf das ChatGPT Modell, du findest ein Beispiel in der Datei `titles.js`, den Prompt auf Zeile 24-28 kannst du anpassen.
 <br/>
 Titel generieren: <br/>
`node titles.js` <br/>