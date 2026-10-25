<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <!-- method="html" + an <html> wrapper: without them browsers treat a bare <table> as XML and show raw text -->
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html>
      <head><title>AutoBid sample catalog</title></head>
      <body>
        <table border="1">
          <tr><th>Brand</th><th>Model</th><th>Type</th><th>City</th><th>Price (Rs.)</th></tr>
          <xsl:for-each select="catalog/car">
            <tr>
              <td><xsl:value-of select="brand"/></td>
              <td><xsl:value-of select="model"/></td>
              <td><xsl:value-of select="@type"/></td>
              <td><xsl:value-of select="city"/></td>
              <td><xsl:value-of select="price"/></td>
            </tr>
          </xsl:for-each>
        </table>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
