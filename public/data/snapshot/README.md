# ABYSS COMMONS — American Samoa 実データパック

取得日: **2026-09-08 UTC**。優先bbox: **west=-171, east=-169, south=-15, north=-14**。
全データは公式公開ソースから取得したローカルsnapshotです。外部公開やAstraへのアップロードはしていません。

## 実装で最初に使うファイル

| 用途 | ファイル | 内容 |
|---|---|---|
| 全体の読み込み案内 | `metadata.json` | bbox、状態、各データの入口、未解決事項 |
| 海底地形 | `gebco/data/gebco_2026_n-14.0_s-15.0_w-171.0_e-169.0_geotiff.tif` | 480列×240行、15秒角、標高m |
| TID | `gebco/data/gebco_2026_tid_n-14.0_s-15.0_w-171.0_e-169.0_geotiff.tif` | 標高と同一グリッドの出典種別 |
| TIDの凡例 | `gebco/tid_codes.json` | 公式コード、分類、bbox内セル数 |
| ROV航跡 | `noaa/tracks_bbox.geojson` | bbox内4潜航の連続LineString |
| ROV座標一覧 | `noaa/track_vertices_bbox.csv` | 21,074点、潜航別の順序を保持 |
| 観測coverage（粗い表示） | `obis/coverage_geohash5_bbox.geojson` | 151セル、`occurrence_count`付き |
| 観測coverage（詳細表示） | `obis/coverage_geohash8_bbox.geojson` | 4,099セル、`occurrence_count`付き |
| 出典・利用条件 | 各フォルダの `metadata.json` | URL・取得時刻・license・attribution・live/snapshot |
| 全体検証 | `validation_report.json` / `SHA256SUMS` | 読み込み・件数・範囲・同値性・SHA-256 |

GEBCOは同名のNetCDF（`.nc`）も同梱しています。公式subsetアプリが返したNetCDFはCDF-1形式でした。元ZIP、公式利用条件PDF、公式説明PDFも保持しています。

## GEBCO 2026

- GeoTIFFとNetCDFの標高・TIDを取得済み。bboxは指定どおりで、両レイヤーとも115,200セル、欠損セルなし。標高範囲は **-5,083〜860 m**。
- 座標はWGS84。GeoTIFFは北から南へ行が並びます。NetCDFの緯度方向は `gebco/validation.json` に記録しています。両形式を座標で揃え、全セル値の一致を確認済みです。
- 標高は海面下が負です。水深を表示する場合は負の標高を反転してください。陸地の正標高を負の水深に変換しないでください。
- 元ファイルには全球の `geospatial_*` 属性も残っています。実際の範囲は座標配列またはGeoTIFFの変換情報を優先してください。
- TIDは**出典データの種類**であり、信頼度スコアや個々の測量の完全なprovenanceではありません。Truth Sliderでは「直接計測由来／間接推定由来／不明」等の凡例を保ち、TIDを確率や正解率として扱わないでください。TIDを拡大縮小する場合は最近傍を使ってください。
- 取得時にログイン、CAPTCHA、明示的な規約同意の操作は要求されませんでした。
- 公式の利用条件・出典表示を引き継いでください。航海・海上安全用途には使えません。

公式: https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid

## NOAA Ocean Exploration / Deep Discoverer

公式NCEIのEX1702航海ページがリンクするNOAAデータミラーから、13潜航のKMLを取得しました。このうち指定bbox内は **DIVE01・DIVE02・DIVE09・DIVE13** の4本です。4本とも全座標がbbox内なので、座標を補間せず元の順序をそのままGeoJSONへ変換しました。全13本の原本と `tracks_ex1702_all.geojson` も同梱しています。

**DIVE01は機器不調で海底に到達していません。** 地図で表示する場合も区別し、海底の探査coverage計算からは `reached_bottom == false` を除外してください。他の3本も、全航跡が海底滞在区間だけであることや、一定幅の観測範囲を保証するデータではありません。

KMLの高さ0は表示用の値で、水深ではありません。GeoJSONは経度・緯度の2Dとし、点ごとの時刻・水深は補っていません。CSVの `vertex_index` は原本内の順序です。

DIVE13の公式掲載日・報告書名は **2017-03-07** ですが、航海概要は2017-02-16〜03-01と記載されています。出典の値を変更せず、`dive_index.json` に不一致を記録しました。これは航跡の取得を妨げるものではありませんが、日付による統合には注意が必要です。

このパックはEX1702の実航跡を提供するもので、American Samoaの全航海・全ROV調査を網羅するものではありません。

公式: https://www.ncei.noaa.gov/waf/okeanos-rov-cruises/ex1702/

## OBIS coverage cache

指定bboxだけを公式API v3へ渡して取得した集約snapshotです。**323,640 occurrence records、65データセット**に対応します。全世界データや32万件分の個別レコードは取得していません。2,246 species、4,025 taxa、年範囲1849〜2026というAPI統計も原文で保存しています。

- 粗いgeohash5と詳細geohash8の両方で、セル件数の合計が323,640と一致しています。
- 実装用GeoJSONはセル境界だけをbboxへ切り詰め、件数を保持しています。原本は `obis/raw/` に保存しています。
- 原本の地点MultiPointはgeohash8の中心です。4地点の中心がbbox境界のわずか外にあるため、overlayにはbbox内へ切り詰めたpolygon版を使ってください。セルの細かさは元観測の測位精度を意味しません。
- OBISの海洋生物データを対象に、時期・深度・分類群を追加で制限していません。個々の `marine=true` 判定で絞り込んだ明細ではありません。
- `occurrence_count` は記録数です。独立した調査回数、個体数、個体密度、実際の分布面積ではありません。観測の偏り、重複的な調査、不確実な座標を含み得ます。
- 未掲載セルは「このcacheに公開観測がない」という意味です。生物がいないことや未探査の証明として扱わないでください。
- データセットmetadataにある全球の範囲・総件数は、bbox内統計ではありません。bbox統計は `obis/raw/statistics.json` を使ってください。

**利用条件は混在し、CC-BY-NC（非商用）を含みます。** 一括で商用利用可能なライセンスとは扱わず、`dataset_licenses_and_citations.json` の65件の原文・引用表記を引き継いでください。曖昧な原文も変更していません。将来、商用利用可能なデータのみが必要なら、該当データセットを除外して集約を再取得する必要があります。

公式API: https://api.obis.org/  
データポリシー: https://portal.obis.org/data/datapolicy/

## 検証と再取得

`raw/` は公式レスポンス・原本です。各原本の `.source.json` は取得URL、最終URL、UTC取得日時、取得時HTTP情報、ファイルサイズ、SHA-256を記録しています。`SHA256SUMS` は同ファイル自身を除く全ファイルの検証用です。

GEBCOの元ZIPはCRC検証済み。両rasterはbbox・サイズ・全セル値を検証済みです。NOAAは全KMLの構文・全座標を検証し、OBISは両gridと統計の件数一致、出典数、導出geometryのbboxを検証しました。

OBISのAPIはliveですが、ここに保存したファイルは固定snapshotです。自動更新はしません。複数API呼び出しはデータベースの同一トランザクションではありませんが、取得時の合計件数は一致しています。GEBCOの生成ZIPのURLは将来期限切れになる可能性があるため、元ZIPを同梱しています。

**取得上の未解決ブロッカー: なし。** ライセンス混在、NOAA日付の不整合、coverageの解釈上の制約は上記とmetadataに明記しました。
