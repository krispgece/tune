# Faz 0 donanım testi: Rival 3 Gen 2

Bu rehberle, yapacağımız uygulamanın (çalışma adı: **Tune**) kullanacağı DPI, rapor hızı ve renk ayarlarını senin
farende tek oturumda deneyeceğiz. Sorduğun "ayarlar uykudan ya da yeniden başlatmadan sonra kalıyor mu?" sorusunu
7. adımda deniyoruz.

Bilgisayarın başında **40-50 dakika** sürer. İsteğe bağlı 7b ve 7c adımları 15-20 dakika daha ekler.

Her adımda şu başlıklar var:

- **Yaz:** terminale yazacağın komut. Her kutuda tek komut var: kopyala, terminale yapıştır (`Ctrl+Shift+V`),
  Enter'a bas.
- **Yap:** (bazı adımlarda) elle yapacağın bir şey, örneğin fareyi çıkarıp takmak.
- **Beklenen:** ne olmasını beklediğimiz. Bu bir tahmin, garanti değil. Başka bir şey görürsen o da değerli bir
  sonuç; olduğu gibi yaz.
- **Not al:** bana göndereceğin bilgi.

## Adımlar

- [ ] Başlamadan (5 dakika)
- [ ] 1. İzin kuralını kur (5 dakika)
- [ ] 2. Erişim ve sürüm (3 dakika)
- [ ] 3. Başlangıç ölçümü (3 dakika)
- [ ] 4. Rapor hızı (5 dakika)
- [ ] 5. DPI (8 dakika)
- [ ] 6. Renk ve bölgeler (8 dakika)
- [ ] 7a. Çıkar-tak (5 dakika)
- [ ] 7b. Askıya al (isteğe bağlı, 5-10 dakika)
- [ ] 7c. Yeniden başlat (isteğe bağlı, 10 dakika)
- [ ] Bana gönder (3 dakika)

## Başlamadan

- **Fareye ne gönderiyoruz?** Yalnızca ayar komutları; "kalıcı kaydet" komutu hiç gönderilmiyor. Yine de fare DPI
  ayarını kendisi saklıyor: ilk testinde (17-18 Kasım) fareyi çıkarıp taktığında DPI kaldı, renk ve rapor hızı
  farenin kendi ayarlarına döndü. Bu yüzden DPI komutları `--yes` ile bitiyor. Farenin önceki DPI kademeleri
  okunamıyor; DPI'yı ancak istediğin değeri yeniden yazarak değiştirebilirsin.
- **Geri alma:** fareyi USB'den çıkar, 5 saniye bekle, geri tak. Bu, renk ve rapor hızını geri alır, DPI'yı almaz.
- **Fare doğrudan bilgisayara takılı olsun:** USB çoğaltıcıya ya da klavyedeki USB girişine değil.
- **Terminal:** `Ctrl+Alt+T` ile aç. Komutları kopyalayabilmek için bu rehberi bilgisayarda da aç. Rehber bu
  bilgisayarda `~/repolar/tune/docs/phase0-hardware-test.md` dosyasında. Komut kutularını görmek için onu Claude
  uygulamasında aç. Kate gibi bir metin düzenleyicide kutuların yerine `` ``` `` satırları görünür; onlar komutun
  parçası değil, kopyalama.
- **İngilizce yazılar normal:** başta tarih-saatli bir `INFO` satırı çıkabilir. Fare komutları ayrıca
  `[EXPERIMENTAL]` ile başlayan sarı bir uyarı yazar: özelliklerin deneysel olduğunu, ssgg'nin "kaydet" komutu
  göndermediğini, ama bu farenin DPI'yı çıkarıp takınca da sakladığını söyler.
- **Hata çıkarsa:** `Error` ya da `error` ile başlayan bir yazı çıkarsa yazının tamamını kopyala; aynı komutu `sudo`
  ile deneme. 1. ya da 2. adımda (isteğe bağlı 2b hariç) hata çıkarsa dur ve bana yaz. Sonraki adımlarda hatayı
  not alıp devam edebilirsin.
- **Not tutmak için:** en sondaki "Bana gönder" şablonunu telefonuna ya da bir not dosyasına kopyala, ilerledikçe
  doldur. Terminaldeki bir yazıyı kopyalamak için onu fareyle seç ve `Ctrl+Shift+C`'ye bas.

**Terimler:**

- **DPI:** farenin hassasiyeti. Sayı büyüdükçe, elini aynı kadar oynattığında imleç daha hızlı gider.
- **Kademe:** DPI düğmesine (tekerleğin arkasındaki düğme) her basışta sırayla geçilen DPI değerlerinden biri.
- **Rapor hızı (Hz):** farenin bilgisayara saniyede kaç kez haber verdiği. 1000 Hz, saniyede 1000 kez demek.
- **Bölge:** farede ayrı renk verilebilen ışık alanlarından biri. ssgg'ye göre bu farede üç bölge var.

## Yapma

- ssgg komutlarının başına `sudo` yazma, hata alsan da. `sudo` yalnızca 1. adımdaki iki komutta var.
- İndirilenler klasöründeki `ssgg-linux-x86_64` dosyasını kullanma; onda bilinen bir DPI hatası var, `--yes`'i de
  tanımaz. Yalnızca `./target/release/ssgg` kullan.
- Rehberde olmayan bir komut ya da değer deneme. Özellikle:
  - `ssgg pollrate mouse`: farenin değil, bilgisayarın bir ayarını değiştirir ve yönetici izni ister. Bizim
    komutumuz `mouse poll-rate`.
  - `ssgg fuzz`: cihazlara bilinmeyen komutlar gönderen bir geliştirici aracı.
- rivalcfg ya da başka bir fare veya ışık programı kullanma.
- Kendini `input` grubuna ekleme; ssgg'nin geniş izin kuralını (`assets/70-steelseries.rules`) kurma. Bizim dar
  kuralımız yeterli.

## 1. İzin kuralını kur

Bu kural sana farenin yalnızca **ayar kanalını** açar; farenin hareket ve tuş kanalları eskisi gibi yalnızca
yöneticiye (root) açık kalır. Testte `sudo` kullanılan tek yer burası: şifreni isteyecek. Şifreyi yazarken ekranda
bir şey görünmez; bu normal.

**Yaz** (sırayla):

```bash
cd ~/repolar/steelseriesgg-rs
```

```bash
sudo install -m 0644 ~/repolar/tune/packaging/linux/70-tune-rival3-gen2.rules /etc/udev/rules.d/
```

```bash
sudo udevadm control --reload-rules
```

Bundan sonraki bütün komutları bu terminalde çalıştır. Yeni bir terminal açarsan önce ilk komutu (`cd ...`) yine
yaz.

**Yap:** Fareyi USB'den çıkar, 5 saniye bekle, geri tak. Sonra yaz:

```bash
ls -l /dev/hidraw*
```

**Beklenen:** Birkaç satır; her satırın başında `crw-------` gibi izin harfleri var. Bu satırlardan **yalnızca
birinde**, harflerin hemen sonunda bir `+` görmeyi bekliyoruz (örneğin `crw-rw----+`). Bu `+`, farenin ayar
kanalına senin erişimin olduğunu gösterir.

**Not al:** Kaç satırda `+` var? `+` olan satırın sonundaki ad (örneğin `/dev/hidraw3`).

- Hiçbir satırda `+` yoksa: **dur**, sonraki adımlara geçme, bana yaz.
- Birden fazla satırda `+` varsa: kaç tane olduğunu yaz ve devam et.

## 2. Erişim ve sürüm (yalnızca okur)

Bu komut fareden yalnızca bilgi ister, hiçbir ayarı değiştirmez.

**Yaz:**

```bash
./target/release/ssgg mouse info
```

**Beklenen** (İngilizce):

- `Using mouse: Rival 3 Gen 2`
- `[EXPERIMENTAL]` ile başlayan sarı uyarı
- `Model: Rival 3 Gen 2`
- `USB id: 1038:1870`
- `Firmware:` ile başlayan bir satır. Yanında farenin yazılım sürümünü görmeyi bekliyoruz; `no version read`
  yazarsa da sorun değil.

**Not al:** `Firmware:` satırının tamamı.

Hata çıkarsa (örneğin içinde `Permission denied` geçen bir yazı): **dur**, `sudo` ile deneme, yazının tamamını bana
gönder.

### 2b. (İsteğe bağlı) Rapor hızını fareden oku

Bu komutun da fareden yalnızca bilgi istediğini düşünüyoruz. Bunu başka bir projenin (Mousework) notlarından
biliyoruz; ssgg ile henüz denenmedi.

**Yaz:**

```bash
./target/release/ssgg mouse info --poll-rate
```

**Beklenen:** 2. adımdaki satırlar, ardından `Polling rate (read back, EXPERIMENTAL):` ile başlayan bir satır. Bu
satırda bir Hz değeri, `not decoded` (çözülemedi) ya da `no reply` (cevap yok) yazabilir; altında harf ve
rakamlardan oluşan bir iki satır daha olabilir. Okuma deneysel; hangisi çıkarsa çıksın işimize yarar.

**Not al:** `Polling rate` satırı ve altındaki satırlar, olduğu gibi.

Burada hata çıkarsa yazının tamamını not al ve 3. adıma geç; durma.

## 3. Başlangıç ölçümü

Bu komut 5 saniye boyunca farenin bilgisayara gönderdiği **hareket** mesajlarını sayar. Yalnızca sayar: fareye
hiçbir şey göndermez, hiçbir şeyi kaydetmez.

**Yaz:**

```bash
timeout --foreground 5 stdbuf -oL xinput test-xi2 --root | grep -c RawMotion
```

**Yap:** Bir elin farenin üstünde dursun; Enter'a öbür elinle bas. Enter'a basar basmaz fareyi 5 saniye boyunca
**hızlı daireler** çizerek oynat. Tıklama; klavyeye, başka bir fareye ya da dokunmatik yüzeye dokunma. Sonraki
bütün ölçümleri de böyle yap.

Bu ölçümü **iki kez** yap, ikisinde de fareyi aynı hızda oynat.

**Beklenen:** Her seferinde 5 saniye sonra tek bir sayı; iki sayının birbirine yakın çıkması. Bu, farenin kendi
ayarıyla ölçülen **başlangıç sayın**; sonraki ölçümleri bununla karşılaştıracağız.

**Not al:** İki sayıyı da.

## 4. Rapor hızı

### 4a. 125 Hz'e düşür

**Yaz:**

```bash
./target/release/ssgg mouse poll-rate 125
```

**Beklenen:** `Polling rate request sent (125 Hz).` ve altında `Echo from the mouse (EXPERIMENTAL):` ile başlayan
bir satır. İmleç biraz daha az akıcı gelebilir; fark etmeyebilirsin de.

**Not al:** `Echo from the mouse` satırı.

**İsteğe bağlı** (yalnızca 2b'de hata çıkmadıysa): rapor hızını fareden yeniden oku.

```bash
./target/release/ssgg mouse info --poll-rate
```

**Beklenen:** `Polling rate (read back, EXPERIMENTAL):` satırında bu kez `125 Hz` görmeyi umuyoruz. Başka bir şey
çıkarsa o da önemli bir sonuç: fareden geri okumanın çalışıp çalışmadığını bu satır gösterecek.

**Not al:** `Polling rate` satırı ve altındaki satırlar, olduğu gibi.

### 4b. Ölç

**Yaz** (Enter'dan hemen sonra yine 5 saniye hızlı daireler):

```bash
timeout --foreground 5 stdbuf -oL xinput test-xi2 --root | grep -c RawMotion
```

**Beklenen:** Başlangıç sayından belirgin şekilde düşük bir sayı.

**Not al:** Sayı.

### 4c. Geri al ve yeniden ölç

Başlangıç sayına (iki ölçümden büyük olanına) bak ve aşağıdaki iki komuttan **yalnızca birini** yaz.

Çoğu durumda bunu yaz (emin değilsen de bunu):

```bash
./target/release/ssgg mouse poll-rate 1000
```

Yalnızca başlangıç sayın 1900 ile 2600 arasındaysa, onun yerine bunu yaz:

```bash
./target/release/ssgg mouse poll-rate 500
```

Sonra ölç (yine 5 saniye hızlı daireler):

```bash
timeout --foreground 5 stdbuf -oL xinput test-xi2 --root | grep -c RawMotion
```

**Beklenen:** Başlangıç sayına yakın bir sayı.

**Not al:** Hangi değeri yazdın (1000 ya da 500) ve ölçülen sayı.

## 5. DPI

Yalnızca aşağıdaki değerleri kullan; 200 ya da 8500 gibi uç değerleri deneme. Her komuttan sonra fareyi biraz
oynat ve imlecin hızını hisset.

Her DPI komutu `--yes` ile bitiyor: fare DPI'yı saklıyor ve önceki kademeleri geri okunamıyor; `--yes` bunu
onayladığın anlamına gelir. `--yes`'i unutursan ssgg fareye hiçbir şey göndermez ve içinde
`Nothing was sent; pass --yes to send it` geçen bir hata yazar; komutu `--yes` ile yeniden yaz.
`unexpected argument '--yes'` diye bir hata çıkarsa `./target/release/ssgg` eski kalmış: dur ve bana yaz.

### 5a. 400

**Yaz:**

```bash
./target/release/ssgg mouse dpi 400 --yes
```

**Beklenen:** `DPI request sent (400).` ve `Echo from the mouse` satırı; imlecin belirgin şekilde yavaşlaması.

**Not al:** Yavaşladı mı? `Echo from the mouse` satırı.

### 5b. 3200

**Yaz:**

```bash
./target/release/ssgg mouse dpi 3200 --yes
```

**Beklenen:** İmlecin belirgin şekilde hızlanması (400'e göre çok daha hızlı).

**Not al:** Hızlandı mı?

### 5c. İki kademe: 800 ve 1600

**Yaz:**

```bash
./target/release/ssgg mouse dpi 800 1600 --yes
```

**Yap:** DPI düğmesine birkaç kez bas; her basıştan sonra fareyi biraz oynat.

**Beklenen:** `DPI stages request sent (800, 1600; stage 1 active).` Başta birinci kademenin (800, yavaş olan)
etkin olması; düğmeye her basışta hızın iki kademe arasında gidip gelmesi.

**Not al:** Düğmeyle hız değişti mi? Kaç farklı hız hissettin? Düğmeye basınca ışıklarda bir şey olduysa onu da yaz.

### 5d. Dört kademe, ikinciden başla

**Yaz:**

```bash
./target/release/ssgg mouse dpi 400 800 1600 3200 --active 2 --yes
```

**Yap:** DPI düğmesine birkaç kez bas; her basıştan sonra fareyi biraz oynat.

**Beklenen:** `DPI stages request sent (400, 800, 1600, 3200; stage 2 active).` Başta ikinci kademenin (800) etkin
olması, yani hızın 5c'nin başındakiyle aynı olması. Düğmeye her basışta bir sonraki kademeye geçmesi, dört kademeyi
dolaşıp başa dönmesi.

**Not al:** Başlangıç hızı 5c'nin başındakine benziyor mu? Düğmeyle kaç farklı hız saydın?

## 6. Renk ve bölgeler

Bu adımda farenin üç ışık bölgesinin nerede olduğunu öğrenmek istiyoruz. Fareyi ışıklarını görebileceğin şekilde
önüne koy.

### 6a. Hepsi kırmızı

**Yaz:**

```bash
./target/release/ssgg mouse color red
```

**Beklenen:** `Colour request sent (red).` ve `Echo from the mouse` satırı; bütün ışıkların kırmızı olması. Bunu
daha önce yapmıştın; şimdi yeni sürümle deniyoruz.

**Not al:** Hepsi kırmızı mı? `Echo from the mouse` satırı.

### 6b. Bölge 1: mavi

**Yaz:**

```bash
./target/release/ssgg mouse color blue --zone 1
```

**Beklenen:** `Colour request sent for zone 1 of 3 (blue).` Bir bölgenin mavi olması, diğer bölgelerin kırmızı
kalması. Bu deneysel: diğer bölgeler söner ya da değişirse o da önemli bir sonuç.

**Not al:** Mavi nerede yandı: ön, orta, arka ya da başka bir yer? Diğer bölgeler ne oldu?

### 6c. Bölge 2: yeşil

**Yaz:**

```bash
./target/release/ssgg mouse color green --zone 2
```

**Beklenen:** Başka bir bölgenin yeşil olması, mavinin yerinde kalması.

**Not al:** Yeşil nerede? Mavi hâlâ yerinde mi?

### 6d. Bölge 3: beyaz

**Yaz:**

```bash
./target/release/ssgg mouse color white --zone 3
```

**Beklenen:** Kalan bölgenin beyaz olması, mavi ve yeşilin yerinde kalması.

**Not al:** Beyaz nerede? Mavi ve yeşil hâlâ yerinde mi?

### 6e. Hepsi yine tek renk

**Yaz:**

```bash
./target/release/ssgg mouse color yellow
```

**Beklenen:** Üç bölgenin de sarı olması.

**Not al:** Hepsi sarı mı?

### 6f. Işıkları kapat

**Yaz:**

```bash
./target/release/ssgg mouse color off
```

**Beklenen:** Bütün ışıkların sönmesi.

**Not al:** Hepsi söndü mü?

### 6g. Tıkla

**Yap:** Terminal penceresinin içine birkaç kez sol tıkla.

**Beklenen:** Her tıklamada beyaz dalganın yine önden arkaya gitmesi. Bu dalga farenin kendi efekti; ssgg'de onu
değiştiren bir komut yok.

**Not al:** Dalga hâlâ var mı? Işıklar kapalıyken nasıl görünüyor?

## 7. Kalıcılık: ayarlar kalıyor mu?

Bu adım senin sorunun cevabı. Fareye kolayca fark edilen üç ayar veriyoruz: kırmızı ışık, yavaş imleç (400 DPI) ve
düşük rapor hızı (125 Hz). Sonra fareyi çıkarıp takıyoruz (7b'de bilgisayarı askıya alıyoruz, 7c'de yeniden
başlatıyoruz) ve hangi ayarın kaldığına bakıyoruz.

### 7a. Çıkar-tak

**Yaz** (üçünü sırayla):

```bash
./target/release/ssgg mouse color red
```

```bash
./target/release/ssgg mouse dpi 400 --yes
```

```bash
./target/release/ssgg mouse poll-rate 125
```

Fare şimdi kırmızı, imleç yavaş olmalı.

**Yap:** Fareyi çıkar, 5 saniye bekle, geri tak. Sonra ölç (yine 5 saniye hızlı daireler):

```bash
timeout --foreground 5 stdbuf -oL xinput test-xi2 --root | grep -c RawMotion
```

**Beklenen:** Işığın kırmızı değil, farenin takılınca gösterdiği kendi ışığı olması; sayının başlangıç sayına
yakın çıkması. İmlecin yavaş kalması: fare DPI'yı saklıyor (ilk testinde de böyle oldu).

**Not al:** Işık ne renk? İmleç yavaş mı, normal mi? Sayı.

Işık hâlâ kırmızıysa ya da sayı hâlâ düşükse bu da bir sonuç: not al, 7b ve 7c'yi yapma, bana yaz.

### 7b. (İsteğe bağlı) Askıya al

Bilgisayarın uykudan uyanırken sorun çıkarıyorsa bu adımı atla.

Önce açık işlerini kaydet ve o ana kadarki notlarını bana gönder: bilgisayar uykudan uyanmazsa onu kapatıp açman
gerekir, o zaman bu bilgisayardaki Claude oturumu ve terminal kapanır. Uyanmazsa (ekran 2 dakika içinde gelmezse)
güç düğmesini bilgisayar kapanana kadar basılı tut, sonra yeniden aç ve bana yaz.

**Yaz** (üçünü sırayla):

```bash
./target/release/ssgg mouse color red
```

```bash
./target/release/ssgg mouse dpi 400 --yes
```

```bash
./target/release/ssgg mouse poll-rate 125
```

**Yap:** Ekranın sağ üst köşesindeki menüyü aç, güç simgesine, sonra **Askıya Al**'a tıkla. 30 saniye bekle. Bir
tuşa ya da güç düğmesine kısaca basarak bilgisayarı uyandır ve oturumunu aç. Sonra ölç (yine 5 saniye hızlı
daireler):

```bash
timeout --foreground 5 stdbuf -oL xinput test-xi2 --root | grep -c RawMotion
```

**Beklenen:** Burada sonucu bilmiyoruz: ayarlar kalabilir ya da fare kendi ayarlarına dönebilir. İkisi de mümkün;
öğrenmek istediğimiz de bu.

**Not al:** Işık ne renk? İmleç yavaş mı, normal mi? Sayı.

Bitince fareyi çıkar, 5 saniye bekle, geri tak.

### 7c. (İsteğe bağlı) Yeniden başlat

Önce açık işlerini kaydet ve o ana kadarki notlarını bana gönder: yeniden başlatınca bu bilgisayardaki Claude
oturumu ve terminal kapanabilir.

**Yaz** (üçünü sırayla):

```bash
./target/release/ssgg mouse color red
```

```bash
./target/release/ssgg mouse dpi 400 --yes
```

```bash
./target/release/ssgg mouse poll-rate 125
```

**Yap:** Bilgisayarı yeniden başlat (sağ üst menü, güç simgesi, **Yeniden Başlat**). Açılınca oturumunu aç,
`Ctrl+Alt+T` ile bir terminal aç ve ölç (yine 5 saniye hızlı daireler):

```bash
timeout --foreground 5 stdbuf -oL xinput test-xi2 --root | grep -c RawMotion
```

**Beklenen:** Burada sonucu bilmiyoruz: ayarlar kalabilir ya da fare kendi ayarlarına dönebilir. İkisi de mümkün;
öğrenmek istediğimiz de bu.

**Not al:** Işık ne renk? İmleç yavaş mı, normal mi? Sayı.

Ayarlar kaldıysa fareyi çıkar, 5 saniye bekle, geri tak.

## Bir şey ters giderse

1. Fareyi çıkar, 5 saniye bekle, geri tak. Bu, renk ve rapor hızını geri alır. DPI kalır: imleç yavaş ya da
   hızlı geliyorsa 5d'deki komutu yeniden yaz (dört kademe, 800'den başlar). Yeni bir terminaldeysen önce
   `cd ~/repolar/steelseriesgg-rs` yaz.
2. Hâlâ bir şey değişik kaldıysa (ışık, imleç hızı, tuşlar): **dur**. Başka bir program ya da komut deneme. Bana
   yaz: hangi adımdaydın, ne yazdın, ne gördün.

## Bana gönder

Bu şablonu kopyala, doldur ve bana gönder. Yapmadığın adımlara "yapılmadı" yaz.

```text
Faz 0 sonuçları
Tarih:
Firmware satırı:

1.  İzin: + olan satır sayısı: ___  hangi satır: ___
2.  mouse info hata verdi mi: ___
2b. Polling rate satırları (olduğu gibi): ___
3.  Başlangıç sayısı: 1. ölçüm ___  2. ölçüm ___
4a. poll-rate 125, Echo satırı: ___  yeniden okuma (Polling rate satırı): ___
4b. 125 Hz'de ölçüm: ___
4c. Geri dönülen değer (1000 / 500): ___  ölçüm: ___
5a. dpi 400, imleç yavaşladı mı: ___  Echo satırı: ___
5b. dpi 3200, imleç hızlandı mı: ___
5c. dpi 800 1600, düğmeyle kaç hız: ___  ışıklarda değişiklik: ___
5d. dpi 400 800 1600 3200 --active 2, başlangıç hızı: ___  düğmeyle kaç hız: ___
6a. Hepsi kırmızı oldu mu: ___  Echo satırı: ___
6b. Bölge 1 (mavi) nerede: ___  diğerleri: ___
6c. Bölge 2 (yeşil) nerede: ___  diğerleri: ___
6d. Bölge 3 (beyaz) nerede: ___  diğerleri: ___
6e. Hepsi sarı oldu mu: ___
6f. off, hepsi söndü mü: ___
6g. Tıklayınca beyaz dalga: ___
7a. Çıkar-tak sonrası: ışık ___  imleç ___  ölçüm ___
7b. Askıya alma sonrası: ışık ___  imleç ___  ölçüm ___
7c. Yeniden başlatma sonrası: ışık ___  imleç ___  ölçüm ___
Hata yazıları (varsa, olduğu gibi):
Başka gözlemler:
```

İzin kuralı test bitince yerinde kalabilir; uygulama da aynı kuralı kullanacak. Kaldırmak istersen bana yaz.

Test bitince imleç 400 DPI'da yavaş kalır. Dört kademeye dönmek için 5d'deki komutu yeniden yaz. 7c'den sonra
yeni bir terminaldeysen önce `cd ~/repolar/steelseriesgg-rs` yaz.
