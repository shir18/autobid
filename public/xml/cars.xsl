<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/catalog">
    <html>
      <head>
        <title>AutoBid catalog (XSLT)</title>
        <style>
          body { font-family: system-ui, sans-serif; margin: 24px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
          th { background: #4F46E5; color: #fff; }
          tr:nth-child(even) { background: #f1f5f9; }
          td.num { text-align: right; }
          .used { color: #b45309; font-weight: 600; }
        </style>
      </head>
      <body>
        <h2>AutoBid catalog — <xsl:value-of select="@count"/> listings (<xsl:value-of select="@currency"/>)</h2>
        <table>
          <tr><th>#</th><th>Car</th><th>Variant</th><th>Type</th><th>Year</th><th>Fuel</th><th>City</th><th>Price</th></tr>
          <!-- sort cheapest first, number each row with position() -->
          <xsl:for-each select="car">
            <xsl:sort select="price" data-type="number" order="ascending"/>
            <tr>
              <td><xsl:value-of select="position()"/></td>
              <td><xsl:value-of select="brand"/><xsl:text> </xsl:text><xsl:value-of select="model"/></td>
              <td><xsl:value-of select="variant"/></td>
              <td><xsl:if test="@type = 'used'"><xsl:attribute name="class">used</xsl:attribute></xsl:if><xsl:value-of select="@type"/></td>
              <td><xsl:value-of select="year"/></td>
              <td><xsl:value-of select="fuel"/></td>
              <td><xsl:value-of select="city"/></td>
              <td class="num">Rs. <xsl:value-of select="format-number(price, '#,##0')"/></td>
            </tr>
          </xsl:for-each>
        </table>
        <p>Total value of listings: Rs. <xsl:value-of select="format-number(sum(car/price), '#,##0')"/></p>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
