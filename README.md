# Alpicut

Dikey kısa videolar (Shorts / Reels / TikTok) için mor temalı, telefonda çalışan video editörü.

## Özellikler
- **Kesme / birleştirme:** klip ekle, kırp, böl, kopyala, sırala, hız ayarı
- **Katmanlar:** video/foto üst katman (B-roll), kare/daire kesim, çerçeve, gölge
- **Yazı + 12 hazır şablon:** Hook, Kinetik, Son Dakika, Alt Bant, İstatistik, Neon…  `*kelime*` ile vurgu rengi
- **Altyazı (SRT):** kelime vurgulu, pop, tek kelime, klasik, kutu — varsayılan font Barlow Condensed
- **Ses:** müzik ekleme, seviye, yavaş açma/kapama, video sesi kontrolü
- **Geçişler:** çapraz, siyaha, flaş, kaydırma, zoom, silme, bulanık, döndür, glitch
- **Katman efektleri:** 14 giriş, 10 çıkış, 6 sürekli animasyon + filtreler
- **Sosyal medya çağrıları:** Abone Ol, Beğen, Takip Et, Yorum, Paylaş, Kaydet… tıklama animasyonlu, tamamen düzenlenebilir
- **Skor kartı**, vinyet, film greni, sinema şeritleri, ilerleme çubuğu
- **Dışa aktarma:** 1080p / 720p / 540p, 30 / 60 fps, MP4
- **Keyframe (v1.1):** konum, ölçek, dönüş, saydamlık; klipte zoom/pan; yumuşak / hızlanan / yavaşlayan / sabit geçiş; hazır kamera hareketleri
- **Şekiller (v1.1):** ok, çember, çizgi, kutu, neon mavi/mor ekran çerçevesi; karışım modları (çarp, ekran, bindirme…)
- **Maske ve yerleşim (v1.1):** dikdörtgen/elips maske, kenar yumuşatma, ters çevirme; bölünmüş ekran, resim içinde resim, yuvarlak kamera
- **SFX (v1.1):** whoosh, hakem düdüğü, tribün, bas vuruş, ding, glitch… uygulama içinde üretilir, telifsiz
- **Kare dondurma, kare ileri/geri, başa dön (v1.1)**
- **Dosya boyutu sınırlı çıktı (v1.1):** 10/30/50/100 MB, sonuç ölçülür ve gerekirse yeniden kodlanır; tek kare PNG
- **Altyazı (v1.1):** VTT içe/dışa, satır böl/birleştir, videoya gömme açık/kapalı
- **Kişisel stiller (v1.1):** yazı ve altyazı stillerini kaydet, dosya olarak paylaş
- Projeler cihazda otomatik kaydedilir, geri al / yinele

## Henüz yok (planlanan)
Ters oynatma, otomatik altyazı, ses temizleme/ducking, renk eğrileri/LUT, chroma key, yüz takibi.

## APK nasıl oluşur?
Bu depoya her `push` yapıldığında GitHub Actions APK'yı otomatik derler.
**Releases** bölümünden `Alpicut.apk` dosyasını telefondan indirip kurabilirsin.

Teknik: Saf HTML/JS editör (`www/`), Capacitor 7 ile Android'e paketlenir.
