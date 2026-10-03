// Capacitor'ın ürettiği Android projesine Alpicut ayarlarını uygular
import fs from 'node:fs';

const mf = 'android/app/src/main/AndroidManifest.xml';
let x = fs.readFileSync(mf, 'utf8');

// Dikey ekran kilidi + klavye açılınca yeniden boyutlandır
if (!x.includes('android:screenOrientation')) {
  x = x.replace('<activity', '<activity\n            android:screenOrientation="portrait"\n            android:windowSoftInputMode="adjustResize"');
}
// Android 10 ve öncesi için Belgeler klasörüne yazma izni
const perms = [
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
  '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />',
  '<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
  '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
  '<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
];
for (const p of perms) if (!x.includes(p.split('"')[1])) x = x.replace('</manifest>', `    ${p}\n</manifest>`);
// Eski cihazlarda paylaşılan depolamaya erişim
if (!x.includes('requestLegacyExternalStorage')) x = x.replace('<application', '<application\n        android:requestLegacyExternalStorage="true"');
fs.writeFileSync(mf, x);

// Uygulama adı
const sx = 'android/app/src/main/res/values/strings.xml';
if (fs.existsSync(sx)) {
  let s = fs.readFileSync(sx, 'utf8');
  s = s.replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">Alpicut</string>')
       .replace(/<string name="title_activity_main">[^<]*<\/string>/, '<string name="title_activity_main">Alpicut</string>');
  fs.writeFileSync(sx, s);
}
console.log('Android ayarları uygulandı');
