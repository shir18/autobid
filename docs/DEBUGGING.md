# AutoBid — DEBUGGING.md

## Chrome DevTools Breakpoints & Watch Expressions

Each section maps to one of the 5 regression bug classes.

---

### Bug Class 1 — Property Typo in Sort Comparator

**File:** `public/controllers/compare.controller.js` — `vm.sortBy()` function

**Breakpoint:** Line inside `vm.cars.sort(function (a, b) { ... })` callback

**Watch expressions:**
```
a[vm.sortKey]
b[vm.sortKey]
Number(a[vm.sortKey]) - Number(b[vm.sortKey])
vm.sortKey
```

**What to look for:** If the result of the subtraction is `NaN`, the sort key is either misspelled or the property doesn't exist on the object. Check `vm.sortKey` against the actual car object keys in the Console: `Object.keys(vm.cars[0])`.

**Deliberate bug to introduce:** Change `a[vm.sortKey]` to `a['pricee']` (double-e). The watch will show `NaN - NaN = NaN` and the array won't sort.

---

### Bug Class 2 — Missing Null-Guard in sendMessage()

**File:** `public/controllers/chat.controller.js` — `vm.send()` function  
**Also:** `public/services/chat.service.js` — `this.send()` method

**Breakpoint:** First line of `vm.send()`

**Watch expressions:**
```
vm.selectedConv
ChatService.selectedConversation
vm.newMsg
```

**What to look for:** If `vm.selectedConv` is `null` and the send button is clicked, the code must return early without attempting `vm.selectedConv._id` (which would throw `TypeError: Cannot read properties of null`).

**Deliberate bug to introduce:** Remove the `if (!this.selectedConversation) return null;` guard in `chat.service.js`. Then click Send without selecting a conversation — it will throw in the console.

---

### Bug Class 3 — Case-Sensitivity in countByStatus()

**File:** `public/filters/status.filter.js` — inside the `statusLabel` filter  
**Also:** `public/controllers/buyer.controller.js` — `vm.orderCounts` usage

**Breakpoint:** Inside the status filter return function

**Watch expressions:**
```
val
val.toLowerCase()
map[val.toLowerCase()]
```

**What to look for:** If the API returns `"OPEN"` but the filter lookup map uses lowercase keys, `map['OPEN']` returns `undefined`. The `.toLowerCase()` call fixes this.

**Deliberate bug to introduce:** Remove the `.toLowerCase()` call in the filter. Then pass `'OPEN'` as status — the label will be empty/undefined instead of `'Open'`.

---

### Bug Class 4 — Off-by-One in Compare Cap Check

**File:** `public/services/compare.service.js` — `this.add()` method

**Breakpoint:** `if (ids.length < MAX_COMPARE)` line

**Watch expressions:**
```
ids.length
MAX_COMPARE
ids.length < MAX_COMPARE
ids.length <= MAX_COMPARE
```

**What to look for:** When `ids.length` is 4, `ids.length < 4` is `false` (correct — blocks 5th item), but `ids.length <= 4` is `true` (bug — allows 5th item). Confirm in the Console with `CompareService.getIds().length`.

**Deliberate bug to introduce:** Change `<` to `<=` in the cap check. Then add 5 cars to compare — all 5 will appear in the compare table.

---

### Bug Class 5 — Inverted Filter in remove()

**File:** `public/controllers/compare.controller.js` — `vm.remove()` function

**Breakpoint:** The `vm.cars.filter(...)` call inside `vm.remove()`

**Watch expressions:**
```
car.id
vm.cars.length
vm.cars.map(c => c.id)
```

**What to look for:** After calling `vm.remove(car)`, the car should be gone and `vm.cars.length` should decrease by 1. If the filter condition is inverted (`c.id === car.id` instead of `c.id !== car.id`), only the removed item remains.

**Deliberate bug to introduce:** Change `c.id !== car.id` to `c.id === car.id` in the filter. Click "Remove" on a car — all other cars disappear and only the "removed" car stays.

---

## General Tips

- Open DevTools → **Sources** → `Ctrl+P` to search file by name
- Use **Logpoints** (right-click breakpoint → "Add logpoint") to log without pausing
- In the **Console**, access AngularJS scope with:
  ```js
  angular.element(document.querySelector('[ng-controller]')).scope()
  ```
- Use **Network** tab → filter by `/api/` to inspect all API calls and response bodies
- For the atomic transaction test: POST to `/api/offers/:id/accept` and check that all other offers for the same requirement show `status: "rejected"` in the requirements panel
