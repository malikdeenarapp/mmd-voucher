/* Markaz Malik Deenar - Payment Voucher app logic */
(function () {
  "use strict";

  var API_BASE = "api/vouchers";

  var HEAD_OF_AC_OPTIONS = [
    "Admission Expenses","Advertisement Expenses","Audit Fee","Bank Charges",
    "Bed, mat, pillow, etc","Cleaning Expenses","Collection Expenses","Computer And Peripherals",
    "Electrical Equipment","Electrical Fittings","Electricity Charges","Esi Payable",
    "Examination Expenses","Festival & Celebrations","Furniture & Fixtures","Garden Expenses",
    "Generator Expenses","Kitchen Utensils","Legal Expenses","Library Books",
    "Mess Expenses","Mineral Water","News Papers & Periodicals","Printing & Stationary",
    "Prize & Award","Ramzan Collection Expenses","Reception & Programme","Repairs & Maintenance",
    "Salary Advance","Salary And Allowances","Scholarship","Software Expenses",
    "Staff Loan","Staff Uniform","Staff Welfare","TDS Payable",
    "Telephone & Internet Charges","Training Expenses","Travelling Expenses","Vehicle Maintenance"
  ];

  /* ---------------- Amount -> words (Indian numbering) ---------------- */
  var ONES = ["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  var TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

  function belowThousand(n) {
    var s = "";
    if (n >= 100) {
      s += ONES[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 0) {
      if (n < 20) {
        s += ONES[n];
      } else {
        s += TENS[Math.floor(n / 10)];
        if (n % 10) s += " " + ONES[n % 10];
      }
    }
    return s.trim();
  }

  function indianInteger(n) {
    if (n === 0) return "Zero";
    var parts = [];
    var crore = Math.floor(n / 10000000); n %= 10000000;
    var lakh = Math.floor(n / 100000); n %= 100000;
    var thousand = Math.floor(n / 1000); n %= 1000;
    var rest = n;
    if (crore) parts.push(belowThousand(crore) + " Crore");
    if (lakh) parts.push(belowThousand(lakh) + " Lakh");
    if (thousand) parts.push(belowThousand(thousand) + " Thousand");
    if (rest) parts.push(belowThousand(rest));
    return parts.join(" ");
  }

  function amountToWords(value) {
    var n = parseFloat(value);
    if (isNaN(n) || n < 0) return "";
    n = Math.round(n * 100) / 100;
    var rupees = Math.floor(n);
    var paise = Math.round((n - rupees) * 100);
    var words = indianInteger(rupees);
    if (paise > 0) {
      words += " and " + belowThousand(paise) + " Paise";
    }
    return words + " Only";
  }

  /* ---------------- Element refs ---------------- */
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    no: $("voucherNo"),
    date: $("voucherDate"),
    headOfAc: $("headOfAc"),
    headOfAcList: $("headOfAcList"),
    nameAddress: $("nameAddress"),
    amount: $("amount"),
    amountWords: $("amountWords"),
    towards: $("towards"),
    paymentMode: $("paymentMode"),
    refLabel: $("refLabel"),
    datedLabel: $("datedLabel"),
    ofLabel: $("ofLabel"),
    chequeNo: $("chequeNo"),
    chequeDate: $("chequeDate"),
    bankName: $("bankName"),
    preparedBy: $("preparedBy"),
    passedAmount: $("passedAmount"),
    passedWords: $("passedWords"),
    sheet: $("voucherSheet"),
    toast: $("saveToast"),
    historyPanel: $("historyPanel"),
    historyList: $("historyList"),
    historyEmpty: $("historyEmpty")
  };

  var passedTouchedByUser = false;

  function todayISO() {
    var d = new Date();
    var tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  }

  function fmtDateDisplay(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    if (p.length !== 3) return iso;
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function refreshWords() {
    els.amountWords.textContent = amountToWords(els.amount.value);
    if (!passedTouchedByUser) {
      els.passedAmount.value = els.amount.value;
    }
    els.passedWords.textContent = amountToWords(els.passedAmount.value);
  }

  function updatePaymentModeUI() {
    var mode = els.paymentMode.value;
    els.refLabel.textContent = mode === "Online" ? "Ref / Txn No" : "Cheque No";
    var hide = mode === "Cash";
    [els.refLabel, els.chequeNo, els.datedLabel, els.chequeDate, els.ofLabel, els.bankName].forEach(function (el) {
      el.style.visibility = hide ? "hidden" : "visible";
    });
  }

  /* ---------------- Head of A/c: searchable select ---------------- */
  function renderHeadList(filter) {
    var q = (filter || "").trim().toLowerCase();
    var matches = HEAD_OF_AC_OPTIONS.filter(function (h) {
      return h.toLowerCase().indexOf(q) !== -1;
    });
    var list = els.headOfAcList;
    list.innerHTML = "";
    if (!matches.length) {
      var empty = document.createElement("li");
      empty.className = "combo-empty";
      empty.textContent = "No match in list — your typed text will be kept";
      list.appendChild(empty);
    } else {
      matches.forEach(function (h, idx) {
        var li = document.createElement("li");
        li.textContent = h;
        li.setAttribute("data-value", h);
        li.setAttribute("role", "option");
        if (idx === 0) li.classList.add("active");
        list.appendChild(li);
      });
    }
    list.hidden = false;
    els.headOfAc.setAttribute("aria-expanded", "true");
  }

  function closeHeadList() {
    els.headOfAcList.hidden = true;
    els.headOfAc.setAttribute("aria-expanded", "false");
  }

  function headListItems() {
    return Array.prototype.slice.call(els.headOfAcList.querySelectorAll("li[data-value]"));
  }

  function moveHeadActive(delta) {
    var items = headListItems();
    if (!items.length) return;
    var idx = items.findIndex(function (li) { return li.classList.contains("active"); });
    if (idx >= 0) items[idx].classList.remove("active");
    idx = (idx + delta + items.length) % items.length;
    items[idx].classList.add("active");
    items[idx].scrollIntoView({ block: "nearest" });
  }

  function wireHeadOfAcCombo() {
    els.headOfAc.addEventListener("focus", function () { renderHeadList(els.headOfAc.value); });
    els.headOfAc.addEventListener("input", function () { renderHeadList(els.headOfAc.value); });
    els.headOfAc.addEventListener("blur", function () { setTimeout(closeHeadList, 150); });
    els.headOfAc.addEventListener("keydown", function (e) {
      if (els.headOfAcList.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        renderHeadList(els.headOfAc.value);
        return;
      }
      if (e.key === "ArrowDown") { e.preventDefault(); moveHeadActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveHeadActive(-1); }
      else if (e.key === "Enter") {
        var items = headListItems();
        var active = items.filter(function (li) { return li.classList.contains("active"); })[0];
        if (active) { e.preventDefault(); els.headOfAc.value = active.getAttribute("data-value"); closeHeadList(); }
      } else if (e.key === "Escape") {
        closeHeadList();
      }
    });
    els.headOfAcList.addEventListener("mousedown", function (e) {
      var li = e.target.closest("li[data-value]");
      if (!li) return;
      els.headOfAc.value = li.getAttribute("data-value");
      closeHeadList();
    });
  }

  /* ---------------- Form <-> data object ---------------- */
  function collect() {
    return {
      no: els.no.value.trim(),
      date: els.date.value,
      headOfAc: els.headOfAc.value.trim(),
      nameAddress: els.nameAddress.value.trim(),
      amount: els.amount.value,
      towards: els.towards.value.trim(),
      paymentMode: els.paymentMode.value,
      chequeNo: els.chequeNo.value.trim(),
      chequeDate: els.chequeDate.value,
      bankName: els.bankName.value.trim(),
      preparedBy: els.preparedBy.value.trim(),
      passedAmount: els.passedAmount.value
    };
  }

  function populate(data) {
    els.no.value = data.no || "";
    els.date.value = data.date || "";
    els.headOfAc.value = data.headOfAc || "";
    els.nameAddress.value = data.nameAddress || "";
    els.amount.value = data.amount || "";
    els.towards.value = data.towards || "";
    els.paymentMode.value = data.paymentMode || "Cash";
    els.chequeNo.value = data.chequeNo || "";
    els.chequeDate.value = data.chequeDate || "";
    els.bankName.value = data.bankName || "";
    els.preparedBy.value = data.preparedBy || "";
    els.passedAmount.value = data.passedAmount || data.amount || "";
    passedTouchedByUser = (data.passedAmount && data.passedAmount !== data.amount);
    refreshWords();
    updatePaymentModeUI();
  }

  function clearForm() {
    populate({ date: todayISO(), paymentMode: "Cash" });
    els.no.focus();
  }

  /* ---------------- History (shared backend, 2-day retention server-side) ---------------- */
  var historyCache = [];

  function safeJson(r) {
    return r.json().catch(function () { return {}; });
  }

  function apiList() {
    return fetch(API_BASE).then(function (r) {
      return safeJson(r).then(function (b) {
        if (!r.ok) throw new Error(b.error || ("HTTP " + r.status + " — is /api/vouchers deployed?"));
        return b.vouchers || [];
      });
    });
  }

  function apiSave(record) {
    return fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    }).then(function (r) {
      return safeJson(r).then(function (b) {
        if (!r.ok) throw new Error(b.error || ("HTTP " + r.status));
        return b.voucher;
      });
    });
  }

  function apiDelete(id) {
    return fetch(API_BASE + "?id=" + encodeURIComponent(id), { method: "DELETE" }).then(function (r) {
      return safeJson(r).then(function (b) {
        if (!r.ok) throw new Error(b.error || ("HTTP " + r.status));
        return b;
      });
    });
  }

  function renderHistory() {
    els.historyEmpty.textContent = "Loading…";
    els.historyEmpty.style.display = "block";
    els.historyList.innerHTML = "";
    return apiList().then(function (list) {
      historyCache = list;
      els.historyList.innerHTML = "";
      els.historyEmpty.textContent = "No vouchers saved in the last 2 days.";
      els.historyEmpty.style.display = list.length ? "none" : "block";
      list.forEach(function (v) {
        var li = document.createElement("li");
        li.className = "history-item";
        var amt = parseFloat(v.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
        li.innerHTML =
          '<div class="hi-top"><span>No. ' + escapeHtml(v.no || "-") + '</span><span>' + fmtDateDisplay(v.date) + '</span></div>' +
          '<div class="hi-name">' + escapeHtml(v.nameAddress || "") + '</div>' +
          '<div class="hi-amount">Rs ' + amt + '</div>' +
          '<div class="hi-actions">' +
          '<button data-act="load" data-id="' + v.id + '">Open</button>' +
          '<button data-act="print" data-id="' + v.id + '">Print</button>' +
          '<button data-act="pdf" data-id="' + v.id + '">PDF</button>' +
          '<button data-act="delete" data-id="' + v.id + '" class="danger">Delete</button>' +
          '</div>';
        els.historyList.appendChild(li);
      });
    }).catch(function (err) {
      els.historyEmpty.textContent = "Couldn't load shared history (" + err.message + "). Check your internet connection, or see BACKEND_SETUP.md if this is the first run.";
      els.historyEmpty.style.display = "block";
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function findById(id) {
    return historyCache.filter(function (v) { return String(v.id) === String(id); })[0];
  }

  function saveCurrentToHistory() {
    var data = collect();
    if (!data.no || !data.date || !data.nameAddress || !data.amount) {
      showToast("Please fill No, Date, Name & Address and Amount before saving.", true);
      return;
    }
    apiSave(data).then(function () {
      return renderHistory();
    }).then(function () {
      showToast("Voucher saved to shared history.");
    }).catch(function (err) {
      showToast("Could not save (" + err.message + "). Check your internet connection.", true);
    });
  }

  var toastTimer = null;
  function showToast(msg, isWarn) {
    els.toast.textContent = msg;
    els.toast.style.background = isWarn ? "#b3261e" : "#1c9c5b";
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, 2600);
  }

  /* ---------------- Print / PDF ---------------- */
  function doPrint() {
    window.print();
  }

  function doDownloadPdf() {
    var data = collect();
    var suggested = "Voucher_" + (data.no || "draft") + "_" + (data.date || todayISO());
    var prevTitle = document.title;
    document.title = suggested;
    function restore() {
      document.title = prevTitle;
      window.removeEventListener("afterprint", restore);
    }
    window.addEventListener("afterprint", restore);
    showToast('In the print dialog, choose "Save as PDF" as the destination.');
    setTimeout(function () { window.print(); }, 350);
  }

  /* ---------------- Screen scaling for small screens ---------------- */
  function fitSheetToScreen() {
    if (window.matchMedia("print").matches) return;
    var wrap = document.querySelector(".paper-wrap");
    var sheet = els.sheet;
    if (!wrap || !sheet) return;
    sheet.style.transform = "";
    if (window.innerWidth > 860) return;
    var natural = sheet.getBoundingClientRect().width;
    var available = wrap.clientWidth - 8;
    if (natural > available && natural > 0) {
      var scale = available / natural;
      sheet.style.transform = "scale(" + scale.toFixed(4) + ")";
      wrap.style.height = (sheet.getBoundingClientRect().height * scale) + "px";
    }
  }

  /* ---------------- PWA install ---------------- */
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var btn = $("btnInstall");
    if (btn) btn.hidden = false;
  });

  function wireInstallButton() {
    var btn = $("btnInstall");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        btn.hidden = true;
      });
    });
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  /* ---------------- Wire up events ---------------- */
  function init() {
    els.amount.addEventListener("input", refreshWords);
    els.passedAmount.addEventListener("input", function () {
      passedTouchedByUser = true;
      els.passedWords.textContent = amountToWords(els.passedAmount.value);
    });
    els.paymentMode.addEventListener("change", updatePaymentModeUI);

    $("btnNew").addEventListener("click", function () {
      if (confirm("Start a new blank voucher? Unsaved changes will be lost.")) clearForm();
    });
    $("btnSave").addEventListener("click", saveCurrentToHistory);
    $("btnPrint").addEventListener("click", doPrint);
    $("btnPdf").addEventListener("click", doDownloadPdf);

    $("btnHistoryToggle").addEventListener("click", function () {
      els.historyPanel.classList.toggle("hidden");
    });
    $("btnHistoryClose").addEventListener("click", function () {
      els.historyPanel.classList.add("hidden");
    });

    els.historyList.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      var id = btn.getAttribute("data-id");
      var act = btn.getAttribute("data-act");
      var rec = findById(id);
      if (!rec) return;
      if (act === "load") {
        populate(rec);
        showToast("Loaded voucher No. " + (rec.no || ""));
      } else if (act === "print") {
        populate(rec);
        setTimeout(doPrint, 150);
      } else if (act === "pdf") {
        populate(rec);
        setTimeout(doDownloadPdf, 150);
      } else if (act === "delete") {
        if (confirm("Delete this voucher from history?")) {
          apiDelete(id).then(function () {
            return renderHistory();
          }).catch(function (err) {
            showToast("Could not delete (" + err.message + ").", true);
          });
        }
      }
    });

    window.addEventListener("resize", fitSheetToScreen);
    window.addEventListener("afterprint", fitSheetToScreen);

    wireHeadOfAcCombo();
    els.historyPanel.classList.add("hidden");
    clearForm();
    renderHistory();
    wireInstallButton();
    setTimeout(fitSheetToScreen, 50);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
