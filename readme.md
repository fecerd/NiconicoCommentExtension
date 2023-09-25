
# NiconicoCommentExtension

dアニメストア ニコニコ支店の動画にニコニコ動画内の公式動画からコメントを移植して流すChrome拡張機能です。

## ・使い方

1. フォルダ全体をダウンロード。

2. Chromeの拡張機能ページから、「パッケージ化されていない拡張機能を読み込む」を選択し、srcフォルダを読み込む。

3. dアニメストア ニコニコ支店の動画にコメントが流れる！

## ・注意

* この拡張機能は描画処理(src/script.js)とmanifest.json以外を<b>[danime-another-comment](https://github.com/noradium/dac)</b>の改変で作成しています。

* 描画処理に関しては、<b>danime-another-comment</b>(以下、改変元)がニコニコのコメント描画機能に取得したコメントを流し込んでいたのに対し、この拡張機能では単純なCSSアニメーションでコメントを流しています。(動画ページの変更に強くなることを期待して)

* manifect.jsonは改変元がversion:2である一方、この拡張機能ではversion:3を採用しており、
拡張機能ページの警告が表示されないようになっています。

* また、本家動画の検索機能について、使っていて気になった部分は改変しています。

* なお、透明度設定やオフセット設定はありません。

* <b>シリーズ内で移動した際に、前の動画のコメントが流れる場合がありますが、ページリロード(F5)で直ります。</b>

---

(改変する場合は以下をチェック)

#### ・透明度
src/script.js:382行目

```javascript
commentStyle.sheet.insertRule(".comment{ opacity: 0.5; font-weight: 600; line-height: 29px; text-shadow: black 1px 0px, black -1px 0px, black 0px -1px, black 0px 1px, black 1px 1px , black -1px 1px, black 1px -1px, black -1px -1px, black 0px 1px, black -0px 1px, black 0px -1px, black -0px -1px, black 1px 0px, black -1px 0px, black 1px -0px, black -1px -0px; }", 1);
```

"opacity: 0.5;"で設定しています。

#### ・オフセット
src/script.js:78行目

```
offset = (dCurrentSeconds - lengthSeconds) * 1000;
```

グローバル変数`offset`を、`dCurrentSceconds`(dアニメストア動画の秒数(ms)) - `lengthSeconds`(公式動画の秒数(ms))に設定しています。


---

(ページの&lt;video&gt;要素を&lt;div&gt;要素で囲って、コメントを含む&lt;span&gt;要素をその子として流しているだけなので、
公式動画の検索さえできれば、他のサイトでも流せそうな気がしないでもない……)
