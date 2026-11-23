# Cric365 (offline, no backend)
Everything runs inside the app on your phone: accounts, teams, players, scoring, stats. No server, no database, no internet.
Data is stored on the device (IndexedDB). Uninstalling the app erases it.

## Try on a computer
    npm install
    npm run dev

## Get the APK (free, no Android Studio)
1. Create a GitHub repository and upload everything in this folder (including the hidden `.github` folder).
2. Open the Actions tab > "Build Android APK" > Run workflow.
3. When it finishes, open the run, download `cric365-apk`, unzip, and install `app-debug.apk` on your phone.

## Or put it online as a normal website
`npm run build` makes a `dist` folder. Drop it on netlify.com/drop or GitHub Pages, open the link on your phone and choose "Add to Home screen".
