# 📱 ICMPP Intranet — Aplicație Android (Capacitor)

Ghid complet pentru a genera APK-ul Android pe PC-ul tău cu Android Studio.

---

## 🎯 Ce ai primit

Aplicația ta web (intranet.icmpp.ro) este împachetată într-un APK Android nativ folosind **Capacitor**.

**Mod de încărcare:** LIVE — aplicația încarcă mereu ultima versiune de pe `https://intranet.icmpp.ro`.
La fiecare update pe care îl fac eu pe platformă, utilizatorii primesc automat noua versiune fără să mai trebuiască să reinstaleze APK-ul. 🚀

**Funcții native incluse:**
- ✅ Splash screen + status bar branding ICMPP
- ✅ Buton "Back" hardware Android (navigare înapoi / ieșire)
- ✅ Autentificare biometric (amprentă / față) — opțional, activabilă din Setări
- ✅ Notificări push native (Firebase Cloud Messaging) — necesită configurare Firebase
- ✅ Semnătură pe touch screen (deja existentă, optimizată)
- ✅ Acces la cameră / fișiere prin WebView nativ

---

## 📋 Prerequisite pe PC-ul tău

1. **Node.js 20+** și `npm` (sau `bun`)
2. **Android Studio** (Hedgehog 2023.1.1+ recomandat) — instalat și pornit cel puțin o dată
3. **JDK 17** (vine cu Android Studio)
4. **Git**

---

## 🚀 Pași pentru primul APK

### 1. Clonează proiectul

```bash
# Mai întâi exportă proiectul pe GitHub din Lovable (buton "Export to GitHub" sus dreapta)
git clone <url-repo-github>
cd <nume-folder>
```

### 2. Instalează dependențe

```bash
npm install
```

### 3. Adaugă platforma Android (o singură dată)

```bash
npx cap add android
```

Acest pas creează folderul `android/` cu un proiect Android Studio complet.

### 4. Build web + generare icoane + sincronizare

```bash
npm run build
npx capacitor-assets generate --android   # generează icoane + splash din folderul resources/
npx cap sync android
```

> 💡 Logo-ul Petru Poni se află în `resources/` (icon.png, icon-foreground.png, icon-background.png, splash.png, splash-dark.png). Rulează `capacitor-assets generate` ori de câte ori înlocuiești logo-ul.


### 5. Deschide în Android Studio

```bash
npx cap open android
```

Așteaptă ca Android Studio să descarce Gradle (5-15 min prima dată).

### 6. Generează APK semnat

În Android Studio:
1. Meniu **Build** → **Generate Signed Bundle / APK**
2. Alege **APK** → **Next**
3. Creează un keystore nou:
   - **Key store path:** `~/icmpp-keystore.jks` (păstrează-l în siguranță!)
   - **Password:** o parolă puternică
   - **Alias:** `icmpp`
   - **Validity:** 25 ani
   - Completează numele instituției
4. **Build variant:** `release`
5. Click **Create**

APK-ul va fi în: `android/app/release/app-release.apk`

⚠️ **IMPORTANT:** Salvează keystore-ul (`.jks`) și parola într-un loc sigur (backup pe USB criptat). Fără ele nu mai poți publica update-uri pentru aplicația existentă — utilizatorii ar trebui să dezinstaleze și reinstaleze.

### 7. Distribuie APK-ul

- Trimite `app-release.apk` colegilor (email, WhatsApp, Telegram, Google Drive)
- Pe telefon, ei trebuie să permită "Install from unknown sources" pentru sursa respectivă
- Instalează → Aplicația apare în meniu cu numele "ICMPP Intranet"

---

## 🔄 La fiecare update viitor

Când fac modificări la cod în Lovable:

```bash
git pull
npm install              # dacă s-au schimbat dependențe
npm run build
npx cap sync android
# Apoi rebuild APK în Android Studio (sau distribuie doar versiunea web — vezi mai jos)
```

**TRUC IMPORTANT:** Pentru că aplicația rulează în mod LIVE (încarcă de pe `intranet.icmpp.ro`), majoritatea modificărilor (UI, business logic, edge functions) NU necesită APK nou! APK-ul se actualizează singur. Trebuie regenerat doar când:
- Schimbi `capacitor.config.ts`
- Adaugi/schimbi plugin-uri native
- Actualizezi `appName` / iconițe / splash

---

## 🔔 Activarea notificărilor push native (FCM)

Notificările push native funcționează prin Firebase Cloud Messaging (FCM), gratuit.

### Pe PC-ul tău:

1. Mergi la https://console.firebase.google.com → **Add project** → numește-l `ICMPP Intranet`
2. **Add app** → Android:
   - **Package name:** `ro.icmpp.intranet` (EXACT acest string)
   - **App nickname:** ICMPP Intranet
3. Descarcă fișierul **`google-services.json`**
4. Pune-l în `android/app/google-services.json`
5. În Firebase console → **Project Settings** → **Cloud Messaging** → activează **Cloud Messaging API (Legacy)** dacă e dezactivat
6. Copiază **Server Key** (în aceeași pagină Cloud Messaging)

### În Lovable:

Spune-mi "adaugă secretul FCM_SERVER_KEY" și îți voi cere valoarea. Voi face restul.

Apoi rebuild APK-ul (`npx cap sync android` + Build) și notificările push native vor funcționa imediat.

---

## 🐛 Probleme comune

**"Gradle sync failed"**: Verifică versiunea JDK (trebuie 17). În Android Studio: **File → Settings → Build → Gradle → Gradle JDK** → alege JDK 17.

**APK nu se instalează pe telefon**: Activează **"Install unknown apps"** din Settings → Apps → Browser/File manager folosit.

**App Protect / Play Protect warning**: Normal pentru APK semnat self-signed. Apăsă "Install anyway".

**App rămâne pe splash screen**: Verifică că `intranet.icmpp.ro` este accesibil din telefon (deschide în Chrome).

**Biometric nu funcționează**: Verifică în Settings → Securitate → Amprentă/Față că ai cel puțin o amprentă înregistrată.

---

## 📞 Suport

Orice problemă, scrie-mi în chat și pot să debug remote prin cod.
