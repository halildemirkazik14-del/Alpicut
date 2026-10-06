# Alpicut

Dikey kısa videolar (Shorts / Reels / TikTok) için telefonda çalışan, temalı (Obsidyen, Altın, Gümüş, Gece, Beyaz, Yakut, Zümrüt + özel renk) video editörü.

## v1.5 — sağlamlık ve kullanım kolaylığı
- **Kare kare dışa aktarma:** video artık ekran kaydı gibi değil, her kare tek tek üretilerek oluşturulur (WebCodecs + [mediabunny](https://github.com/Vanilagy/mediabunny), MPL-2.0). Kare atlaması ve ses kayması yok; sonuç her telefonda aynı MP4. Ses ayrıca, kayıpsız karıştırılır; hızlandırılmış kliplerde ses perdesi korunur.
- **Önce menü, sonra panel:** zaman çizelgesinde veya önizlemede bir öğeye dokununca küçük bir hızlı işlem menüsü açılır; hiçbir şey kendiliğinden kapanmaz/örtülmez.
- **Açıklamalı kategori menüleri:** araç çubuğundaki her kategori, içindeki araçları açıklamalarıyla gösteren bir pencerede açılır.
- **Keyframe şeridi videonun hemen altında:** ◀ ◆ ▶, öğenin keyframe'leri, OTO keyframe. Seçili klibi önizlemede iki parmakla yakınlaştır / tek parmakla kaydır — keyframe olarak yazılır.
- **Yanlış dokunmaya karşı güvenli:** kaydırıcılar yalnızca tutamaçtan ya da basılı tutup kaydırınca değişir, her değişiklikte "↶ önceki değer" çıkar. Zaman çizelgesinde öğeyi taşımak için basılı tutmak gerekir; her düzenlemede "Geri al" bildirimi.
- **Paneller videonun üstüne açılmaz;** küçültülen panel hareketle üst çubuğa uçar ve parlayan bir çip olarak kalır.
- **Kaydırırken önizleme kararmaz.**
- **Kurtarma kaydı:** uygulama çökse veya telefon kapansa bile son değişiklikler geri gelir. Hata olursa donmuş ekran yerine uyarı çıkar.
- **Yeni ses kütüphanesi (Alpicut Ses Fabrikası):** 216 özgün, telifsiz efekt — whoosh, riser, gerilim, glitch, darbe/boom, braam, downlifter, pop, bildirim, komik, spor, ortam. Tamamı derlemede sentezlenir (`scripts/sfx-forge.mjs`).
- **Altyazı şablonları:** 30 hazır görünüm (kelime vurgulu, kutulu, karaoke, neon, sinema, podcast…) ve ayrıntılı stil (vurgu tipi, animasyon, kutu, gölge, parlama). Otomatik altyazıda sessizlikte uydurulan kelimeler atılır, satırlar karakter sınırıyla bölünür.
- **Yapay zekâ seçenekleri:** Claude, ChatGPT, DeepSeek, Gemini, Groq, Mistral, Grok, OpenRouter ve kendi OpenAI uyumlu sunucun (Ollama, LM Studio…). Groq ile ücretsiz kotalı Whisper large-v3 altyazı.
- **Her sektöre şablon:** 153 yazı şablonu (vlog, seyahat, yemek, iş, eğitim, moda, fitness, oyun, e-ticaret, emlak, otel & mekan, düğün, motivasyon, müzik, komedi…), 27 proje şablonu, düzenlenebilir çıkartma setleri (satış, sosyal medya, bilgi, tepki, seyahat, yemek, etkinlik) ve genişletilmiş emoji.

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
- **Bağlama duyarlı araç çubuğu (v1.2):** seçili öğeye göre değişen araçlar; panellerde Uygula/İptal, tek geri alma adımı
- **Renk (v1.2):** pozlama, kontrast, doygunluk, canlılık, sıcaklık, ton, gölge/parlak; RGB eğrileri; 7 yerleşik LUT + .cube yükleme; histogram ve dalga formu; renk kopyala/yapıştır; ayarlama katmanı
- **Chroma key (v1.2):** önizlemeden renk seçme, tolerans, kenar yumuşatma, renk taşması azaltma
- **Efekt kataloğu (v1.2):** 22 efekt (sarsıntı, darbe zoom, ritim zoom/flaş, RGB, glitch, VHS, piksel, ışık sızıntısı, bloom, eski film…), önizlemeli kartlar, favoriler, son kullanılanlar
- **Çıkartmalar (v1.2):** GOL!, VAR, Ofsayt, kırmızı/sarı kart, penaltı, MVP, canlı… ve emoji
- **Profesyonel ses (v1.2):** konuşma/müzik/SFX grupları, mikser, master limiter, seviye ölçer ve clip uyarısı, otomatik ducking, EQ + uğultu filtresi + kompresör, ses keyframe'i, seviye eşitleme
- **Seslendirme kaydı (v1.2):** mikrofonla, video sessiz oynarken
- **Sessizlikleri kes (v1.2):** analiz, dinleyerek seçme, kesip boşlukları kapatma (altyazı/katmanlar da kayar)
- **Ritim (v1.2):** müzikte vuruş tespiti, ritim işaretleri, ritimde böl, işaretlere yapışma
- **Slip, katman gizle/kilitle/sessiz (v1.2)**
- **Marka kitleri, kapak (thumbnail) editörü, proje sürümleri, .alpicut yedek paketi, eksik medyayı yeniden bağlama (v1.2)**
- **Yapay zekâ (v1.3, cihaz üzerinde):** Whisper ile otomatik altyazı (kelime zamanlı, Türkçe dahil), metinden kurgu ve dolgu kelime temizliği, MediaPipe ile arka plan silme, yüz takibiyle akıllı dikey kadraj, Piper ile metinden sese, RNNoise ile gürültü giderme; isteğe bağlı kendi API anahtarınla asistan (hook, başlık, hashtag, çeviri, bölüm, senaryo)
- **Geçişler (v1.3):** gl-transitions kütüphanesinden 122 sinematik geçiş (MIT), önizlemeli ve aranabilir
- **Yazı (v1.3):** 46 şablon, harf harf animasyonlar (dalga, düşme, dağılma, glitch, neon titreme…), 1700+ Google Fonts + 22 internetsiz font
- **Sosyal medya şablonları (v1.3):** yorum, yanıt, canlı sohbet, mesaj balonu, bildirim, sayaçlar, anket, soru kutusu, gönderi, profil, abone bandı, kalp yağmuru… (31 şablon, tamamı düzenlenebilir)
- **Ses kütüphanesi (v1.3):** ~1750 CC0 ses efekti (Kenney, OpenGameArt) + 530 kamu malı klasik müzik kaydı (Wikimedia Commons)
- **Stüdyo ses (v1.3):** gürültü giderme + EQ + de-esser + kompresör + seviye eşitleme; ses efektleri (eko, salon, stadyum, telefon, radyo, megafon, robot, su altı)
- **Hız eğrileri ve ters oynatma (v1.3)**, cilt yumuşatma ve keskinleştirme
- **Maske (v1.3):** 11 şekil (yıldız, kalp, üçgen, bölmeler…), kliplerde de; çoklu seçim ve gruplama (bileşik katman)
- **Ses dalgası katmanı, proje şablonları (v1.3):** futbol Shorts, son dakika, yüzsüz podcast, yapay zekâ videosu, vlog, YouTube yatay
- **Dokunmatik kontroller (v1.3):** –/+ düğmeli büyük kaydırıcılar, değere dokunup yazma, çift dokunuşla sıfırlama; önizlemede iki parmakla yakınlaştırma/kaydırma
- **Yüzen paneller (v1.4):** aynı anda 3 panel, X ile kapatma, – ile üst çubuğa küçültme, başlıktan sürükleme, köşeden boyutlandırma, çift dokunuşla tam ekran; zaman çizelgesine dokununca onu örten paneller küçülür; önizlemeye dokunmak paneli kapatmaz
- **Temalar (v1.4):** 7 hazır tema + özel vurgu rengi, yeni logo, premium görünüm
- **Alpi-co (v1.4):** sohbet asistanı — "jumpcut yap", "altyazı ekle", "hışırtıyı temizle", "Vivaldi ekle", "zoom ekle"… internetsiz komutlarla; Claude/ChatGPT bağlıysa serbest cümlelerle ve araç kullanarak; her değişiklik tek dokunuşla geri alınır; proje kontrolü (self kontrol) ve tek dokunuşla düzeltme
- **Otomatik kurgu (v1.4):** Claude veya ChatGPT (kendi API anahtarınla) transkripti okuyup jumpcut, hook, zoom, ses efekti, geçiş, müzik, abone butonu ekler
- **Altyazı (v1.4):** telefonda Whisper (bellek dostu) veya OpenAI Whisper (en doğru); Claude/ChatGPT ile yazım düzeltme
- **Seslendirme stüdyosu (v1.4):** ElevenLabs tarzı ses kartları; Piper (cihazda), OpenAI (ton/duygu yönergeli), ElevenLabs (Multilingual v2 / v3); satır satır klip
- **Kayıt stüdyosu (v1.4):** sıkıştırmasız WAV, doğal mod (telefon işlemesi kapalı), giriş kazancı, ortam gürültüsü ölçümü, spektral hışırtı giderme + RNNoise + genişletici, ham/işlenmiş karşılaştırma
- **Keyframe (v1.4):** 12 eğri (otomatik yumuşak, sinüs, geri esneme, elastik, zıplama, özel bezier düzenleyici), grafik görünümü, tümünü yumuşat
- **Yeni kaydırıcı (v1.4):** dokunduğun yerde zıplamaz, göreli sürükleme, hassas mod, varsayılana yapışma
- **Kütüphaneler (v1.4):** 80 efekt (parçacık, ışık, retro, sanat, kamera, ekran…), 62 filtre (sinematik, spor, retro, S/B, portre…), 132 geçiş (kategorili, animasyonlu önizleme), 86 yazı şablonu, 49 sosyal şablon (iPhone ve WhatsApp tarzı sohbet, YouTube kanal kartviziti, X/Instagram profil kartı, yarım ekran yazı, bitiş ekranı, alt bant, haber bandı, oyuncu kartı, VS kartı), 30 viral tarz SFX
- **Favoriler (v1.4):** her özellikte ☆ — Favorilerim panelinden tek dokunuşla uygula
- Projeler cihazda otomatik kaydedilir, geri al / yinele

## Henüz yok (planlanan)
Nesne takibi (yalnız yüz takibi var), çok kameralı kurgu, video sabitleme, klip içinde iç içe sekans (ana izde). Claude/ChatGPT abonelik hesabıyla giriş (sağlayıcılar izin vermediği için API anahtarı kullanılır).

## Lisanslar
Kod: MIT. Geçişler: gl-transitions (MIT/BSD). Ses efektleri: CC0. Müzik: kamu malı (Wikimedia Commons). Fontlar: SIL OFL. Yapay zekâ modelleri: Whisper (MIT), MediaPipe (Apache 2.0), Piper sesleri (çeşitli açık lisanslar), RNNoise (BSD).

## APK nasıl oluşur?
Bu depoya her `push` yapıldığında GitHub Actions APK'yı otomatik derler.
**Releases** bölümünden `Alpicut.apk` dosyasını telefondan indirip kurabilirsin.

Teknik: Saf HTML/JS editör (`www/`), Capacitor 7 ile Android'e paketlenir.

## v1.6 yenilikleri
- **Cızırtısız ses:** önizleme sesi arka planda tek parça olarak hazırlanır, video ses saatini izler; yumuşak limiter
- **Proxy:** ağır videolar için hafif önizleme kopyası (540p), dışa aktarmada orijinal kalite
- **Motion stüdyosu (59 şablon):** yapay zekâ sohbeti (Alpi-co), komut yazımı, görsel üretimi, kod/terminal/diff, pop-up, 2D/3D motion, kağıt stop-motion, sci-fi HUD
- **21 yeni geçiş:** yapay zekâ & dijital (nöral ağ, veri taraması, hologram, kod yağmuru…) + HyperFrames sinematik geçişleri
- **Kağıt stop-motion efekti** (kare tutmalı) ve kesik kağıt efekti
- **Yeni tasarım:** inceltilmiş mor tema (Ametist + Lila gün), Bricolage Grotesque + Source Serif 4, A + makas logo

## v1.7 yenilikleri
- **Vibe editing:** videoyu anlat, havasını seç → yapay zekâ (veya internetsiz tarif) kurgular, motion şablonlarını kendisi yerleştirir
- **Assets:** tüm projelerde ortak medya kütüphanesi, klasörler, küçültülebilir pencere
- **Tam ekran oynatma**, taşınabilir paneller, timeline başında **kapak** + 16 kapak şablonu (istersen videonun ilk karesine)
- **Ses stüdyosu:** gürültü giderme (önce/sonra), 50/60 Hz uğultu, rüzgâr; konuşma / arka plan ayırma, karaoke
- **Arka plan silme:** donan maske hatası düzeltildi; insan (saç detaylı) veya dokunarak seçilen **nesne** + takip, titreme önleme
- **İçerik:** 164 filtre · 213 motion şablonu · 178 sosyal medya çağrısı
- **Ses efektleri artık gerçek kayıt** (Kenney, OpenGameArt, Wikimedia Commons — CC0/kamu malı), Türkçe arama
- **Müzik kütüphanesi:** 13 tür (sinematik, lo-fi, elektronik, piyano, caz…) + klasik; süre filtresi, son kullanılanlar, atıf yönetimi
- Düzeltmeler: ana sayfa şablon kartlarının ezilmesi, kapak pikselleşmesi, geri hareketiyle yanlışlıkla çıkış, kaydırırken anlık önizleme, dışa aktarmada ilk siyah kare

## Teşekkürler / lisanslar
- [HyperFrames](https://github.com/heygen-com/hyperframes) (HeyGen) — Apache License 2.0: sinematik shader geçişleri uyarlandı, motion şablonları blok kataloğundan esinlendi. Lisans: `www/licenses/hyperframes-LICENSE-Apache-2.0.txt`
- [gl-transitions](https://github.com/gl-transitions/gl-transitions) — MIT
- Bricolage Grotesque, Source Serif 4 — SIL Open Font License
