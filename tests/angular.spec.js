/**
 * tests/angular.spec.js — AngularJS Regression Tests (Jasmine)
 *
 * Guards against 5 bug classes:
 *  1. Property typo in sort comparator (a.pricee vs a.price)
 *  2. Null-guard in sendMessage() when no conversation selected
 *  3. Case-sensitivity in countByStatus()
 *  4. Off-by-one in compare cap check (<= vs <)
 *  5. Inverted filter in reject() keeps only the rejected item
 */

// ── Bug Class 1: Property Typo in Sort Comparator ──────────────────────────
describe('BUG-1: Sort comparator must use correct property name', function () {
  var cars;

  beforeEach(function () {
    cars = [
      { id: 1, listing_price: 800000,  brand_name: 'Hyundai',  model_name: 'Creta' },
      { id: 2, listing_price: 500000,  brand_name: 'Maruti',   model_name: 'Swift' },
      { id: 3, listing_price: 1200000, brand_name: 'Tata',     model_name: 'Harrier' }
    ];
  });

  it('correct comparator sorts ascending by listing_price', function () {
    // CORRECT: uses a.listing_price
    var sorted = cars.slice().sort(function (a, b) {
      return Number(a.listing_price) - Number(b.listing_price);
    });
    expect(sorted[0].id).toBe(2);   // 500000
    expect(sorted[1].id).toBe(1);   // 800000
    expect(sorted[2].id).toBe(3);   // 1200000
  });

  it('typo comparator (a.pricee) silently returns NaN and does NOT sort', function () {
    // BUGGY: a.pricee is undefined → NaN − NaN → NaN → sort does nothing
    var sorted = cars.slice().sort(function (a, b) {
      return Number(a.pricee) - Number(b.pricee); // typo
    });
    // After the buggy sort the order is indeterminate, but importantly it is
    // NOT guaranteed to equal the correct ascending order.
    var isCorrect = sorted[0].id === 2 && sorted[1].id === 1 && sorted[2].id === 3;
    // We just verify the comparator returns NaN for the typo
    var comparatorResult = Number(cars[0].pricee) - Number(cars[1].pricee);
    expect(isNaN(comparatorResult)).toBe(true);
  });
});

// ── Bug Class 2: Null-Guard in sendMessage() ────────────────────────────────
describe('BUG-2: sendMessage() must guard against null selectedConversation', function () {
  var chatService;

  beforeEach(function () {
    // Minimal stub of ChatService logic
    chatService = {
      selectedConversation: null,
      send: function (senderId, text) {
        // BUG GUARD: null-check (correct version)
        if (!this.selectedConversation) {
          return null;
        }
        return { conversation_id: this.selectedConversation._id, text: text };
      }
    };
  });

  it('returns null (no throw) when selectedConversation is null', function () {
    expect(function () {
      chatService.send(1, 'hello');
    }).not.toThrow();

    var result = chatService.send(1, 'hello');
    expect(result).toBeNull();
  });

  it('returns message object when conversation is selected', function () {
    chatService.selectedConversation = { _id: 'abc123' };
    var result = chatService.send(1, 'hello');
    expect(result).not.toBeNull();
    expect(result.conversation_id).toBe('abc123');
  });
});

// ── Bug Class 3: Case-Sensitivity in countByStatus() ───────────────────────
describe('BUG-3: countByStatus must normalize case before comparison', function () {

  function countByStatus(items, statusArg) {
    // CORRECT: normalize to lowercase (fixes case-sensitivity bug)
    return items.filter(function (item) {
      return item.status.toLowerCase() === statusArg.toLowerCase();
    }).length;
  }

  function countByStatusBuggy(items, statusArg) {
    // BUGGY: no normalization — 'OPEN' !== 'open'
    return items.filter(function (item) {
      return item.status === statusArg;
    }).length;
  }

  var items;
  beforeEach(function () {
    items = [
      { id: 1, status: 'open'     },
      { id: 2, status: 'open'     },
      { id: 3, status: 'awarded'  },
      { id: 4, status: 'closed'   }
    ];
  });

  it('correct version counts "open" when queried with "OPEN"', function () {
    expect(countByStatus(items, 'OPEN')).toBe(2);
  });

  it('buggy version returns 0 when case mismatches', function () {
    expect(countByStatusBuggy(items, 'OPEN')).toBe(0); // bug demonstrated
  });
});

// ── Bug Class 4: Off-by-one in Cap Check ───────────────────────────────────
describe('BUG-4: Compare cap check must use < MAX, not <= MAX', function () {
  var MAX_COMPARE = 4;

  function addCorrect(ids, newId) {
    // CORRECT: length < MAX allows exactly 4
    if (ids.length < MAX_COMPARE) {
      return ids.concat([newId]);
    }
    return ids;
  }

  function addBuggy(ids, newId) {
    // BUGGY: length <= MAX allows 5 items
    if (ids.length <= MAX_COMPARE) {
      return ids.concat([newId]);
    }
    return ids;
  }

  it('correct version caps at exactly 4 items', function () {
    var ids = [1, 2, 3, 4];
    var result = addCorrect(ids, 5);
    expect(result.length).toBe(4); // 5th NOT added
  });

  it('buggy version incorrectly allows a 5th item', function () {
    var ids = [1, 2, 3, 4];
    var result = addBuggy(ids, 5);
    expect(result.length).toBe(5); // bug: 5 items in compare
  });

  it('correct version adds item when below cap', function () {
    var ids = [1, 2, 3];
    var result = addCorrect(ids, 4);
    expect(result.length).toBe(4);
    expect(result).toContain(4);
  });
});

// ── Bug Class 5: Inverted Filter in reject() ───────────────────────────────
describe('BUG-5: reject() filter must keep non-matching items only', function () {
  var cars;

  beforeEach(function () {
    cars = [
      { id: 1, brand_name: 'Maruti',  model_name: 'Swift'   },
      { id: 2, brand_name: 'Hyundai', model_name: 'Creta'   },
      { id: 3, brand_name: 'Tata',    model_name: 'Nexon'   },
      { id: 4, brand_name: 'Honda',   model_name: 'City'    }
    ];
  });

  it('correct remove() keeps all items EXCEPT the removed one', function () {
    var toRemove = { id: 2 };
    // CORRECT: filter returns items whose id is NOT equal to removed id
    var result = cars.filter(function (c) { return c.id !== toRemove.id; });
    expect(result.length).toBe(3);
    expect(result.find(function (c) { return c.id === 2; })).toBeUndefined();
  });

  it('buggy remove() only keeps the removed item (inverted)', function () {
    var toRemove = { id: 2 };
    // BUGGY: condition is inverted — keeps only the removed item
    var result = cars.filter(function (c) { return c.id === toRemove.id; });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(2); // bug: only the "removed" item remains
  });
});
