# Third-Party Notices

This application incorporates third-party software and assets. Their license
notices are reproduced below in compliance with their respective licenses.

The application's own source code is distributed under the MIT License — see
[LICENSE](LICENSE).

---

## Runtime libraries

### jsQR (v1.4.0)

- Source: https://github.com/cozmo/jsQR
- License: Apache License 2.0
- Copyright (c) 2017 Cosmo Wolfe

Loaded from `https://unpkg.com/jsqr@1.4.0/dist/jsQR.js`.

### Sortable.js (v1.15.0)

- Source: https://github.com/SortableJS/Sortable
- License: MIT
- Copyright (c) 2019-present Lebedev Konstantin, Owen Yang, et al.

Loaded from `https://unpkg.com/sortablejs@1.15.0/Sortable.min.js`.

### qrcode-generator (v1.4.4)

- Source: https://github.com/kazuhikoarase/qrcode-generator
- License: MIT
- Copyright (c) 2009 Kazuhiko Arase

Loaded from `https://unpkg.com/qrcode-generator@1.4.4/qrcode.js`.

### Capacitor (@capacitor/core, @capacitor/ios, @capacitor/android, @capacitor/cli) (v6.x)

- Source: https://github.com/ionic-team/capacitor
- License: MIT
- Copyright (c) Drifty Co.

Used as the native runtime when the project is wrapped as an iOS / Android
application.

---

## Fonts and icons

### Material Symbols Outlined

- Provider: Google Fonts
- License: Apache License 2.0
- Source: https://github.com/google/material-design-icons

Loaded from
`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0`.

---

## External services (not bundled)

The following services are reached over the network at runtime; no third-party
code is redistributed in this repository on their behalf.

### r.jina.ai (Reader by Jina AI)

- Used to fetch `og:title` / `og:image` metadata for hihaho embed pages.
- Subject to Jina AI's Terms of Service: https://jina.ai/legal/

### hihaho player (player.hihaho.com)

- Used to display interactive video content inside an `<iframe>`.
- Subject to hihaho's Terms of Service: https://www.hihaho.com/

### LINE share endpoint

- The "Share to LINE" action opens
  `https://line.me/R/msg/text/?<text>` with prefilled content.
- LINE is a trademark of LY Corporation.

---

## License texts

### MIT License (applies to Sortable.js, qrcode-generator, Capacitor)

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### Apache License 2.0 (applies to jsQR, Material Symbols Outlined)

The full text of the Apache License 2.0 is available at
https://www.apache.org/licenses/LICENSE-2.0.txt. A summary:

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

When the application is repackaged into a redistributable binary (for
example, an iOS / Android build via Capacitor), the full
`LICENSE` and `NOTICE` files of each Apache-2.0 component must be included
alongside the binary.

---

## Trademarks

The following are trademarks of their respective owners. They are referenced
in this application solely to identify the goods and services they describe;
no endorsement is implied:

- **hihaho** — hihaho B.V. https://www.hihaho.com/
- **LINE** — LY Corporation https://line.me/
- **Google Chat**, **Material Symbols**, **Google Fonts** — Google LLC
