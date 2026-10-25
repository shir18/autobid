# How to show the output of Experiment 8, step by step

Do this in two parts. **Part A** uses the hand-written sample car catalog (`catalog.xml`), which follows the lab procedure exactly. **Part B** shows the same ideas on the live AutoBid catalog from the database. Take a screenshot at each step for your record.

## Before you start

1. Open a terminal in the `autobid` folder (unzip it first).
2. Run `npm install` once, then `npm start`.
3. Wait for the message `AutoBid is running → http://localhost:3000`.
4. Keep the terminal open and use Chrome or Edge.

Always open the files through `http://localhost:3000/...` and **not** by double-clicking them. Browsers block a local file from loading its CSS or XSLT stylesheet, so the page would look plain.

---

## Part A: the sample car catalog

### Step 1: Show the raw XML

Open `view-source:http://localhost:3000/xml/catalog.xml` in the browser (or press Ctrl+U on the page).

You will see the XML text: the `<?xml ...?>` declaration, the `<?xml-stylesheet type="text/css" href="catalog.css"?>` line, and `<catalog>` with three `<car>` entries (Maruti Suzuki Swift, Hyundai Creta, and a used Tata Nexon). Each car has `brand`, `model`, `city` and `price`.

**What to explain:** XML only stores data. The tags (`brand`, `model`, `city`, `price`) are names we invented, and nothing in the file says how it should look. The `type="new|used"` attribute marks the kind of listing. The `xml-stylesheet` line is what links the file to a stylesheet.

### Step 2: Validate and format

1. Go to `http://localhost:3000`, click **XML Lab** in the top menu, and scroll to **Formatter & validator**.
2. Paste the catalog XML into the box, or click **Sample**.
3. Click **Validate & format**.

Expected output:
* A green box saying "Well-formed — root `<catalog>`, N elements" (6 for the Sample button; 16 if you paste the full `catalog.xml`).
* Below it, the **Formatted output**, indented so each nested tag sits two spaces further in.

Show an error too:
1. Click **Break it**, then **Validate & format** again.
2. A red box appears with two lines:
   * `Line 1: Unescaped '&' – use &amp;`
   * `Line 1: Mismatched tag: expected </model> but found </modle>`

   and no formatted output is produced.

**What to explain:** "Well-formed" means the XML follows the syntax rules. Every tag must be closed in the right order, there must be one root element, attribute values must be quoted, and `&` must be written as `&amp;`. This is what an online validator such as freeformatter.com checks. If you want to match the lab sheet literally, paste the same XML there and take a screenshot as well.

### Step 3: Show the CSS output

Open `http://localhost:3000/xml/catalog.xml`.

**Expected output:** a card-style list. Each car sits in a bordered box with the brand and model in bold on one line, the city in italics ("City: Mumbai"), and the price shown as "Price: Rs. 650000". The used Nexon has an amber left border.

**What to explain:** this is the same file you saw in Step 1, but now the browser applied `catalog.css`.
* `display: block` rules make each XML element a box.
* `price::before { content: 'Price: Rs. ' }` adds the label text from CSS, even though it isn't in the XML data.
* `car[type="used"]` is an attribute selector that styles used cars differently.

### Step 4: Show the XSLT output

Open `http://localhost:3000/xml/catalog-xslt.xml`.

**Expected output:** a table with the headings Brand, Model, Type, City, Price (Rs.) and three rows:

| Brand | Model | Type | City | Price (Rs.) |
|---|---|---|---|---|
| Maruti Suzuki | Swift | new | Mumbai | 650000 |
| Hyundai | Creta | new | Chennai | 1150000 |
| Tata Motors | Nexon | used | Hyderabad | 870000 |

**What to explain:** the data is the same, and only one line changed:

```xml
<?xml-stylesheet type="text/css" href="catalog.css"?>   <!-- Step 3 -->
<?xml-stylesheet type="text/xsl" href="catalog.xsl"?>   <!-- Step 4 -->
```

CSS only changes how the data looks. XSLT changes its structure. It loops over each `<car>` with `xsl:for-each` and builds an HTML table row for each one with `xsl:value-of`.

### Comparison table for your record

| | Raw XML | CSS | XSLT |
|---|---|---|---|
| Stylesheet line | none | `text/css` | `text/xsl` |
| What the browser shows | plain text or tree | card list | HTML table |
| What the stylesheet does | nothing | styles the elements | transforms XML into HTML |

---

## Part B: your live AutoBid car catalog

Go back to **XML Lab** in the navbar. The top card shows the live car listings as XML, and the buttons switch between the views:

* **1 · Raw XML:** plain catalog data with no stylesheet. Click **Open in new tab ↗** to see it full size. Each `<car>` has brand, model, variant, year, city, body type, fuel, transmission and price.
* **2 · CSS styled:** dark cards, with a coloured edge on used cars and pill badges for year, city and fuel.
* **3 · XSLT table:** an HTML table sorted cheapest first, with row numbers, Rs. prices and a total at the bottom.
* **Use the filters.** Choose *Used cars* or a different number of cars and watch the output change.
* **Download .xml** saves the catalog as `autobid-catalog.xml`, which you can open in VS Code to show the file.

**What to explain:** the data comes from the database and is turned into XML on the fly. The three buttons only change the `<?xml-stylesheet?>` line, and you can see the difference at `view-source:http://localhost:3000/api/xml/cars?mode=css` and the same URL with `mode=xsl`.

---

## Suggested screenshots

1. The raw XML text (Step 1).
2. The green "well-formed" box with the formatted output (Step 2).
3. The red error box (Step 2, "Break it").
4. The CSS card view of `catalog.xml` (Step 3).
5. The XSLT table of `catalog-xslt.xml` (Step 4).
6. The car catalog in CSS mode and in XSLT mode (Part B).

## If something doesn't show

* **The page looks like plain text or a tree.** You opened the file with `file://`, or you are on the raw view. Use the `localhost:3000` address.
* **The XSLT page is blank or unstyled.** Chrome has announced it is removing XSLT support, so your version may not run it. On the XML Lab page, click **HTML fallback** to get the same table built on the server. Say in your viva that CSS styling still works and that XSLT support is being phased out in browsers.
* **"Port 3000 is already in use".** Run `PORT=3001 npm start` and use `localhost:3001`.
