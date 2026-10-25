# Experiment 9: Practice with XML DTD (CarWale/AutoBid Context)

This document outlines the procedure, code, and implementation details for Experiment 9 regarding XML Document Type Definitions (DTD). We have perfectly contextualized the experiment for your AutoBid (CareWale clone) project by adapting every single question into an automotive/car-bidding domain rather than using generic students or bookstores.

## 1. Where the Code Is Stored
All the required XML and DTD files for the 7 questions have been created in your project under the directory:
`autobid/docs/experiment-09/`

The files mapped to the original questions are:
- **Q1 (Students -> Customers):** `q1_customers.xml` (Internal DTD)
- **Q2 (Bookstore -> Dealership):** `q2_dealership.xml` & `q2_dealership.dtd` (External DTD)
- **Q3 (Company Employee -> AutoBid Staff):** `q3_staff.xml` (Internal DTD)
- **Q4 (Recipe Book -> Service Manual):** `q4_service_manual.xml` & `q4_service_manual.dtd` (External DTD)
- **Q5 (Movies Catalog -> Car Reviews):** `q5_reviews.xml` (Internal DTD)
- **Q6 (Product Inventory -> Spare Parts Inventory):** `q6_parts_inventory.xml` & `q6_parts_inventory.dtd` (External DTD)

## 2. Implementing the Procedure into the AutoBid Project

Although AutoBid primarily uses JSON for its REST APIs, XML is heavily used in automotive software. By translating the generic lab questions into AutoBid-specific modules, we can see exactly how it applies to your project:
- **Q2 Dealership**: Dealerships often use XML to share their car inventories in bulk with aggregators like CarWale.
- **Q6 Parts Inventory**: If AutoBid expands into selling certified spare parts or tracks parts for refurbishing cars, XML catalogs are standard for syncing with suppliers.
- **Your Project Enhancement**: Your project already contains an XML endpoint (`/api/xml/cars`) from Experiment 8 which handles XML catalog generation. DTDs take this a step further by validating the **structure** and **data types** of the XML, preventing bad data from entering your MySQL database when running batch imports.

---

## 3. Step-by-Step Procedure to Complete the Experiment

Follow these steps to demonstrate the output for your college experiment evaluation using the tailored CarWale data:

### **Step 1: Locate the XML Files**
Open your VS Code and navigate to `autobid/docs/experiment-09/`. Here you will find all the files corresponding to questions 1 through 6, fully themed for AutoBid.

### **Step 2: Understand the Specific Solutions (Q-by-Q)**
Be ready to explain how you answered the sub-questions:
* **Q1 (Optional Elements)**: In `q1_customers.xml`, we made address and phone optional by adding a `?` quantifier in the DTD: `<!ELEMENT customer (name, age, preferred_car, budget, address?, phone?)>`.
* **Q2 (External DTD)**: The DTD is saved separately in `q2_dealership.dtd` and referenced in the XML using `<!DOCTYPE dealership SYSTEM "q2_dealership.dtd">`. The `price?` quantifier makes price optional.
* **Q3 (Invalid Elements)**: If you add an invalid element (like `<commission>`) that is not defined in the DTD, the XML parser will throw an error. I included a commented-out invalid element as an example inside `q3_staff.xml`.
* **Q4 (Attributes and Mandatory Elements)**: `<!ELEMENT parts_list (part+)>` uses the `+` operator to ensure at least ONE part is present. The `quantity` and `unit` are made optional using `#IMPLIED` in `<!ATTLIST>`.
* **Q5 (Enforcing 4-digit Year)**: DTD does *not* support regex or strictly enforcing exactly 4 digits for text nodes. We defined it as `<!ELEMENT release_year (#PCDATA)>`. If your evaluator asks, explain that to strictly enforce a 4-digit rule, an **XML Schema (XSD)** is required instead of DTD.
* **Q6 (Required Attribute)**: The unique ID is enforced as required using `#REQUIRED` in the DTD: `<!ATTLIST part id ID #REQUIRED>`.
* **Q7 (External DTD conversion)**: Explained and demonstrated through questions 2, 4, and 6. To convert, you extract the content inside `<!DOCTYPE [ ... ]>` to a `.dtd` file and replace it with `<!DOCTYPE rootElement SYSTEM "filename.dtd">`.

### **Step 3: Show the Output (Validation)**
To get the "Result" and "Screenshots" for your document, you need to validate the XML against the DTD.

**Using VS Code Extensions (Recommended for Screenshots)**
1. Install the VS Code extension named **"XML" by Red Hat**.
2. Open any of the XML files in `docs/experiment-09/`.
3. The extension will automatically read the `SYSTEM` DTD or the internal DTD and validate the file.
4. **Take screenshots** of your VS Code editor showing the valid file (no red lines).
5. Next, intentionally break a rule. For example, delete the `id` attribute from the `<part>` element in `q6_parts_inventory.xml`. The extension will show a red squiggly line stating `The required attribute 'id' is missing`. **Take a screenshot of this error** to prove the DTD works.

**Alternative: Online Validator**
1. Go to an online XML validator (like `https://www.xmlvalidation.com/`).
2. Copy the content of `q6_parts_inventory.xml` and paste it. Check the box to validate against an external DTD, and provide the content of `q6_parts_inventory.dtd`. 
3. Click Validate and take a screenshot of the results.

### **Step 4: Add the Output to your Document**
Paste the screenshots taken in Step 3 under the "Screen Shots" section of your lab template. Write down a brief conclusion under the "Result" section stating: *"The XML documents representing the CarWale clone entities (Customers, Dealership, Staff, Service Manuals, Reviews, and Inventory) were successfully created, linked to both internal and external DTDs, and validated successfully."*
