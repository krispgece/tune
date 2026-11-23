# Tepsi ve oturum açılınca başlama denemesi

Tune artık pencere kapanınca tepside çalışmaya devam ediyor ve istersen oturum açılınca kendiliğinden başlıyor. Bu
liste 15-20 dakika sürer. Arayüz İngilizce olduğu için düğme ve yazılar İngilizce verildi, ne demek oldukları parantez
içinde.

Önce bil:

- Oturum açılınca başlama yalnızca **yayın sürümünde** (`target/release/tune`) çalışır. `npm run app` ile açılan
  geliştirme sürümünde bu ayar kapalı görünür; çünkü o sürüm arayüzünü terminaldeki geliştirme sunucusundan alır.
- Aynı anda tek Tune çalışır. Tune açıkken onu yeniden başlatırsan yeni bir kopya açılmaz, çalışanın penceresi öne
  gelir.
- Deneme sırasında `ssgg` komutu çalıştırma; fareyle aynı anda iki program konuşmasın.

## 0. Yayın sürümünü derle

Tune açıksa kapat: `npm run app` çalışıyorsa o terminalde `Ctrl+C`. Sonra:

```bash
cd ~/repolar/tune
```

```bash
npm run app:release
```

Derleme birkaç dakika sürer. Bitince başlat:

```bash
target/release/tune
```

Bu terminali deneme boyunca açık bırak.

## 1. Tepsi simgesi

**Bak:** ekranın sağ üstündeki çubukta Tune simgesi var. Simgeye tıkla: menüde **Open Tune** (Tune'u aç) ve
**Quit Tune** (Tune'dan çık) var.

**Not al:** simge göründü mü, menüde ne yazıyor.

## 2. Pencereyi kapat

Pencerenin sağ üstündeki çarpıyla kapat. **Bak:** Tune tepside kalır, terminaldeki komut bitmez.

Şimdi fareyi çıkar, 5 saniye bekle, tak. **Bak:** birkaç saniye içinde fare Tune'daki renge döner (gökkuşağı değil).
Pencere kapalıyken de gönderiyor demektir.

Sonra tepsi menüsünden **Open Tune**. **Bak:** pencere geri gelir.

## 3. İkinci kopya açılmaz

Yeni bir terminal aç (Ctrl+Alt+T) ve aynı komutu yaz:

```bash
~/repolar/tune/target/release/tune
```

**Bak:** yeni pencere açılmaz; çalışan Tune'un penceresi öne gelir. Yeni terminaldeki komut hemen biter ve
"Tune is already running; its window opens." yazar.

## 4. Menü dili

**Settings** › **Language** › **Türkçe**. Tepsi menüsünü aç. **Bak:** menü **Tune'u aç** ve **Tune'dan çık** olur.
Sonra dili yine **English** yap.

## 5. Oturum açılınca başlama

**Settings** › **Start-up** › **Start at login** (oturum açılınca başlat) › **On**.

Dosyaya bak:

```bash
cat ~/.config/autostart/local.tune.desktop
```

**Bak:** içinde `Exec="/home/pc/repolar/tune/target/release/tune" --background` satırı var.

## 6. Oturumu kapatıp aç (isteğe bağlı)

Bu adım, Tune'un oturum açılınca kendiliğinden başlayıp ayarları gönderdiğini gösterir. Şimdi yapamıyorsan bir
sonraki açılışta da bakabilirsin.

1. Tepsi menüsünden **Quit Tune**. Terminaldeki komut biter.
2. Fareyi çıkar-tak: fare kendi gökkuşağına döner.
3. Oturumu kapat ve yeniden aç (ya da bilgisayarı yeniden başlat).
4. **Bak:** pencere açılmaz, tepsi simgesi gelir. Birkaç saniye içinde fare Tune'daki renge döner.

## 7. Kapatma

Tepsi menüsünden **Quit Tune**. Sonra denetle:

```bash
pgrep -af '[t]arget/release/[t]une'
```

**Bak:** hiçbir şey yazmaz.

Oturum açılınca başlamayı istemiyorsan Tune'u yeniden aç, **Settings** › **Start-up** › **Start at login** › **Off**
yap. 5. adımdaki `cat` komutu artık "No such file" der.

## Bana gönder

```text
Tepsi denemesi
1. Simge göründü mü:          menü:
2. Kapatınca tepside kaldı mı:          çıkar-tak sonrası renk:          pencere geri geldi mi:
3. İkinci kopya:
4. Türkçe menü:
5. Start at login dosyası:
6. Oturum açılınca (yaptıysan):
7. Quit sonrası pgrep:
Garip bir şey oldu mu:
```
