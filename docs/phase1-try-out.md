# Tune'u gerçek farede deneme

Tune artık ayarları fareye gönderiyor. Bu liste 15-20 dakika sürer. Arayüz İngilizce olduğu için düğme ve yazılar
İngilizce verildi, ne demek oldukları parantez içinde.

Önce bil:

- **Renk ve rapor hızı** bilgisayarda saklanır. Fare çıkarılınca bunları unutur. Tune onları açılınca gönderir; açıkken
  de fare her takıldığında ve bilgisayar uykudan uyanınca yeniden gönderir.
- **DPI kademelerini fare kendisi saklar**, en son kaldığı kademeyle birlikte. Tune onları yalnızca sen
  değiştirdiğinde gönderir; gönderince fare başlangıç kademesine (**Start**) geçer.
- Tune kapalıyken hiçbir şey göndermez. Oturum açılınca kendiliğinden başlaması henüz yok.
- Deneme sırasında `ssgg` komutu çalıştırma; fareyle aynı anda iki program konuşmasın.

## 0. Başlat

Tune açıksa kapat: çalıştığı terminalde `Ctrl+C`. Sonra yeni sürümü başlat:

```bash
cd ~/repolar/tune
```

```bash
npm run app
```

İlk açılışta derleme birkaç dakika sürebilir. Deneme bitene kadar bu terminali açık bırak.

## 1. Açılış

**Bak:** soldaki listede Rival 3 Gen 2 **Connected** (bağlı). Birkaç saniye içinde fare, Tune'daki renge döner.
**Performance** sayfasında rapor hızı kartı önce **Sending…** (gönderiliyor), sonra **Verified** (doğrulandı) yazar.
DPI kartı **Not sent yet** (henüz gönderilmedi) yazar: Tune'daki kademeler (1500'lü) fareye hiç gönderilmedi, farede
bizim yüklediğimiz 400/800/1600/3200 var.

**Not al:** renk değişti mi, rapor hızı ve DPI kartlarında ne yazıyor.

## 2. DPI kademeleri

**Performance** sayfasında kademeleri 400, 800, 1600, 3200 yap: 1500'ü 1600'e çevirmen yeter.

**Bak:** DPI kartı **Sending…**, sonra **Mouse received** (fare aldı). Fare başlangıç kademesine geçer. DPI tuşu dört
kademe arasında dolaşır.

**Not al:** kartta ne yazdı, DPI tuşuyla kaç hız var.

## 3. Renk

**Lighting** sayfası:

1. **Single colour** (tek renk) › **Red**. **Bak:** fare kırmızı, kart **Mouse received**.
2. **By zone** (bölge bölge): **Front** mavi, **Middle** yeşil, **Rear** beyaz. **Bak:** her bölge kendi renginde.
3. **Off** (kapalı). **Bak:** ışıklar söner; tıklayınca beyaz dalga yine geçer.

Sonra **Single colour** › **Red**'e dön; 5. adımda işine yarar.

## 4. Rapor hızı

**Performance** sayfasında **125 Hz** seç. **Bak:** kart **Verified**.

Ölç: komutu yaz, Enter'a bas ve 5 saniye boyunca fareyi durmadan oynat.

```bash
timeout --foreground 5 stdbuf -oL xinput test-xi2 --root | grep -c RawMotion
```

**Bak:** yaklaşık 625. 125 Hz'de kal; 5. adımda kullanacağız.

## 5. Çıkar-tak

1. Fareyi çıkar, 5 saniye bekle, tak.
2. **Bak:** birkaç saniye içinde fare kırmızıya döner (gökkuşağı değil). Rapor hızı kartı **Verified**, renk kartı
   **Mouse received**.
3. Ölç (4. adımdaki komut). **Bak:** yaklaşık 625.
4. DPI tuşuyla kademeleri dolaş. **Bak:** dört kademe yerinde; fare en son kaldığı kademeden başladı.

Çıkar-takları arasında en az 10 saniye bekle. Tune bir şey gönderdikten hemen sonra fare kısa sürede iki kez çıkarsa
Tune korumaya geçer: **Automatic apply stopped…** (otomatik uygulama durdu) uyarısı çıkar ve fare **Paused**
(duraklatıldı) görünür. Tune'u kapatıp açsan da koruma sürer. Çıkarsa **Try again**'e (yeniden dene) bas ve bana yaz.

Bitince rapor hızını **1000 Hz**'e geri al.

## 6. Tune'u kapatıp aç

Tune penceresini kapat; terminaldeki `npm run app` da biter. Yeniden başlat:

```bash
npm run app
```

**Bak:** birkaç saniye içinde rapor hızı kartı **Verified**. DPI kartı **On the mouse** (farede kayıtlı): Tune,
farenin 2. adımda kademeleri aldığını hatırlıyor. Fare kırmızı kalır.

## 7. Uyku (isteğe bağlı)

Bilgisayarı askıya al, sonra uyandır. **Bak:** birkaç saniye içinde fare yine kırmızı.

## 8. Yönetmeyi bırak (isteğe bağlı)

**Device** sayfası › **Stop managing** (yönetmeyi bırak), açılan pencerede yine **Stop managing**. Fareyi çıkar-tak.
**Bak:** gökkuşağı ve farenin kendi rapor hızı gelir; DPI kademeleri kalır. Bir ayarı değiştirdiğinde Tune o ayarı
yeniden yönetmeye başlar.

## Bana gönder

```text
Faz 1 denemesi
1. Açılışta renk döndü mü:          rapor hızı kartı:          DPI kartı:
2. DPI kartı:          tuşla kaç hız:
3. Kırmızı:          bölgeler (ön, orta, arka):          kapalı:
4. 125 Hz kartı:          ölçüm:
5. Çıkar-tak sonrası renk:          kartlar:          ölçüm:          DPI:
6. Yeniden açınca rapor hızı kartı:          DPI kartı:
7. Uyku sonrası (yaptıysan):
8. Yönetmeyi bırak (yaptıysan):
"Couldn't send" ya da "Sent" yazan kart oldu mu, hangisi:
```
