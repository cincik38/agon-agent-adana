/**
 * UYU ROOM HOTEL - Sheets Kopru v5
 * JSONP (callback) destekli - tarayici CORS engeli YOK
 *
 * KURULUM: Bu kodu yapistir > Kaydet >
 * Deploy > Manage deployments > kalem > New version > Deploy
 */
var PROP = PropertiesService.getScriptProperties();

function doGet(e) {
  e = e || { parameter: {} };
  var p = e.parameter || {};
  var action = p.action || 'ping';

  try {
    if (action === 'ping') {
      return out_({
        ok: true,
        hotel: 'UYU ROOM HOTEL',
        sheets: true,
        jsonp: true,
        version: ver_(),
        updatedAt: PROP.getProperty('updatedAt'),
        updatedBy: PROP.getProperty('updatedBy'),
        ts: now_()
      }, e);
    }
    if (action === 'pull') {
      return out_(pull_(), e);
    }
    if (action === 'chunkStart') {
      var sid = String(p.sid || '');
      var total = Number(p.total || 0);
      var by = String(p.by || 'Personel');
      if (!sid || total < 1) {
        return out_({ ok: false, error: 'sid/total gerekli' }, e);
      }
      PROP.setProperty('chunk_' + sid + '_total', String(total));
      PROP.setProperty('chunk_' + sid + '_by', by);
      PROP.setProperty('chunk_' + sid + '_count', '0');
      return out_({ ok: true, sid: sid, total: total }, e);
    }
    if (action === 'chunk') {
      var sid2 = String(p.sid || '');
      var ix = String(p.i || '0');
      var part = String(p.d || '');
      if (!sid2) {
        return out_({ ok: false, error: 'sid yok' }, e);
      }
      PROP.setProperty('chunk_' + sid2 + '_' + ix, part);
      var c = Number(PROP.getProperty('chunk_' + sid2 + '_count') || 0) + 1;
      PROP.setProperty('chunk_' + sid2 + '_count', String(c));
      return out_({ ok: true, i: Number(ix), count: c }, e);
    }
    if (action === 'chunkCommit') {
      return out_(chunkCommit_(String(p.sid || '')), e);
    }
    if (action === 'rewriteSheets') {
      return out_(rewriteOnly_(), e);
    }
    return out_({ ok: false, error: 'Bilinmeyen action: ' + action }, e);
  } catch (err) {
    return out_({ ok: false, error: String(err) }, e);
  }
}

function doPost(e) {
  try {
    var body = parseBody_(e);
    var action = body.action || 'push';
    if (action === 'import' || action === 'sync') {
      action = 'push';
    }
    if (action === 'push') {
      return out_(push_(body), e);
    }
    if (action === 'pull') {
      return out_(pull_(), e);
    }
    if (action === 'ping') {
      return out_({ ok: true, hotel: 'UYU ROOM HOTEL', version: ver_() }, e);
    }
    if (action === 'rewriteSheets') {
      return out_(rewriteOnly_(), e);
    }
    return out_({ ok: false, error: 'Bilinmeyen action: ' + action }, e);
  } catch (err) {
    return out_({ ok: false, error: String(err) }, e);
  }
}

function chunkCommit_(sid) {
  if (!sid) {
    return { ok: false, error: 'sid yok' };
  }
  var total = Number(PROP.getProperty('chunk_' + sid + '_total') || 0);
  if (total < 1) {
    return { ok: false, error: 'chunk oturumu yok' };
  }
  var parts = [];
  var i;
  for (i = 0; i < total; i++) {
    var part = PROP.getProperty('chunk_' + sid + '_' + i);
    if (part === null || part === undefined) {
      return { ok: false, error: 'eksik parca: ' + i };
    }
    parts.push(part);
    PROP.deleteProperty('chunk_' + sid + '_' + i);
  }
  PROP.deleteProperty('chunk_' + sid + '_total');
  PROP.deleteProperty('chunk_' + sid + '_count');
  var by = PROP.getProperty('chunk_' + sid + '_by') || 'Personel';
  PROP.deleteProperty('chunk_' + sid + '_by');

  var jsonStr = parts.join('');
  var data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    return { ok: false, error: 'JSON birlestirme hatasi' };
  }

  return push_({
    action: 'push',
    force: true,
    expectedVersion: 0,
    envelope: {
      updatedBy: by,
      deviceId: 'chunk',
      hotel: (data.settings && data.settings.name) || 'UYU ROOM HOTEL',
      data: data
    }
  });
}

function parseBody_(e) {
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  if (e && e.postData && e.postData.contents) {
    var contents = e.postData.contents;
    if (contents.indexOf('payload=') === 0) {
      var decoded = decodeURIComponent(contents.substring(8).replace(/\+/g, ' '));
      return JSON.parse(decoded);
    }
    return JSON.parse(contents);
  }
  return {};
}

function pull_() {
  var data = readData_();
  if (!data) {
    return { ok: true, empty: true };
  }
  return {
    ok: true,
    empty: false,
    envelope: {
      version: ver_(),
      updatedAt: PROP.getProperty('updatedAt'),
      updatedBy: PROP.getProperty('updatedBy'),
      deviceId: PROP.getProperty('deviceId'),
      hotel: PROP.getProperty('hotel') || 'UYU ROOM HOTEL',
      data: data
    }
  };
}

function push_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var current = ver_();
    var expected = Number(body.expectedVersion || 0);
    var force = !!body.force;
    if (!force && expected < current && readData_()) {
      return {
        ok: false,
        conflict: true,
        envelope: pull_().envelope,
        error: 'Version conflict'
      };
    }
    var env = body.envelope || {};
    var data = env.data || body.data;
    if (!data) {
      return { ok: false, error: 'data yok' };
    }

    var next = current + 1;
    var ts = now_();
    var by = env.updatedBy || body.updatedBy || 'Personel';

    writeData_(data);
    PROP.setProperty('version', String(next));
    PROP.setProperty('updatedAt', ts);
    PROP.setProperty('updatedBy', by);
    PROP.setProperty('deviceId', env.deviceId || '');
    PROP.setProperty('hotel', env.hotel || 'UYU ROOM HOTEL');
    writeSheets_(data, next, ts, by);

    return {
      ok: true,
      sheetsWritten: true,
      envelope: {
        version: next,
        updatedAt: ts,
        updatedBy: by,
        deviceId: env.deviceId || '',
        hotel: env.hotel || 'UYU ROOM HOTEL',
        data: data
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function rewriteOnly_() {
  var data = readData_();
  if (!data) {
    return { ok: false, error: 'Henuz veri yok' };
  }
  var ts = now_();
  var v = ver_();
  writeSheets_(data, v, ts, PROP.getProperty('updatedBy') || '');
  return { ok: true, message: 'Sheet yazildi v' + v };
}

function readData_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('_DB');
  if (sh) {
    var v = String(sh.getRange('A1').getValue() || '');
    if (v && v.charAt(0) === '{') {
      try {
        return JSON.parse(v);
      } catch (e1) {}
    }
  }
  var raw = PROP.getProperty('stateJson');
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (e2) {
    return null;
  }
}

function writeData_(data) {
  var json = JSON.stringify(data);
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('_DB');
  if (!sh) {
    sh = ss.insertSheet('_DB');
  }
  sh.clear();
  sh.getRange('A1').setValue(json);
  sh.getRange('A2').setValue('Guncelleme: ' + now_());
  try {
    if (json.length < 400000) {
      PROP.setProperty('stateJson', json);
    }
  } catch (e3) {}
}

function writeSheets_(data, version, ts, by) {
  var ss = SpreadsheetApp.getActive();
  var rooms = active_(data.rooms);
  var guests = active_(data.guests);
  var reservations = active_(data.reservations);
  var payments = active_(data.payments);
  var staff = active_(data.staff);
  var ledger = active_(data.ledger);
  var invoices = active_(data.invoices);
  var tasks = active_(data.tasks);
  var recurring = active_(data.recurringExpenses);
  var inHouse = 0;
  var pendingInv = 0;
  var i;
  for (i = 0; i < reservations.length; i++) {
    if (reservations[i].status === 'checked_in') {
      inHouse++;
    }
  }
  for (i = 0; i < invoices.length; i++) {
    if (invoices[i].status === 'pending') {
      pendingInv++;
    }
  }

  put_(ss, 'Ozet', [
    ['Alan', 'Deger'],
    ['Otel', (data.settings && data.settings.name) || 'UYU ROOM HOTEL'],
    ['Version', version],
    ['Son guncelleme', ts],
    ['Guncelleyen', by],
    ['Oda', rooms.length],
    ['Misafir', guests.length],
    ['Rezervasyon', reservations.length],
    ['In-house', inHouse],
    ['Odeme', payments.length],
    ['Personel', staff.length],
    ['Muhasebe', ledger.length],
    ['Bekleyen fatura', pendingInv],
    ['HK', tasks.length]
  ]);

  put_(ss, 'Odalar', headRows_(
    ['id', 'no', 'kat', 'tip', 'durum', 'hk', 'kapasite', 'yatak', 'fiyat', 'olanaklar', 'aciklama', 'sonTemizlik'],
    rooms,
    function (r) {
      return [
        r.id, r.number, r.floor, r.type, r.status, r.housekeeping,
        r.capacity, r.beds, r.pricePerNight, join_(r.amenities),
        r.description || '', r.lastCleaned || ''
      ];
    }
  ));

  put_(ss, 'Misafirler', headRows_(
    ['id', 'ad', 'soyad', 'email', 'telefon', 'kimlik', 'uyruk', 'adres', 'vip', 'konaklama', 'harcama', 'not', 'kayit'],
    guests,
    function (g) {
      return [
        g.id, g.firstName, g.lastName, g.email, g.phone, g.idNumber,
        g.nationality, g.address, g.vip ? 'EVET' : 'HAYIR',
        g.totalStays, g.totalSpent, g.notes || '', g.createdAt || ''
      ];
    }
  ));

  put_(ss, 'Rezervasyonlar', headRows_(
    [
      'id', 'kod', 'misafirId', 'misafir', 'odaId', 'odaNo', 'giris', 'cikis',
      'yetiskin', 'cocuk', 'yanMisafirSayisi', 'yanMisafirler', 'durum', 'odemeDurumu',
      'gecelik', 'indirim', 'kdv', 'depozito', 'kaynak', 'not', 'ozelIstek',
      'olusturma', 'checkInAt', 'checkOutAt'
    ],
    reservations,
    function (r) {
      var g = byId_(data.guests, r.guestId);
      var room = byId_(data.rooms, r.roomId);
      var comps = r.companions || [];
      var cnames = [];
      var ci;
      for (ci = 0; ci < comps.length; ci++) {
        var c = comps[ci];
        var cg = byId_(data.guests, c.guestId);
        var n = cg ? (cg.firstName + ' ' + cg.lastName) : c.guestId;
        if (c.isChild) {
          n += '(cocuk)';
        }
        if (c.isExtra) {
          n += '(ekstra)';
        }
        cnames.push(n);
      }
      return [
        r.id, r.code, r.guestId, g ? (g.firstName + ' ' + g.lastName) : '',
        r.roomId, room ? room.number : '',
        r.checkIn, r.checkOut, r.adults, r.children,
        comps.length, cnames.join(' | '),
        r.status, r.paymentStatus, r.nightlyRate, r.discount, r.taxRate, r.deposit,
        r.source || '', r.notes || '', r.specialRequests || '',
        r.createdAt || '', r.checkedInAt || '', r.checkedOutAt || ''
      ];
    }
  ));

  put_(ss, 'Odemeler', headRows_(
    ['id', 'rezervasyonId', 'rezervasyonKod', 'tutar', 'yontem', 'tarih', 'not', 'alan'],
    payments,
    function (p) {
      var r = byId_(data.reservations, p.reservationId);
      return [
        p.id, p.reservationId, r ? r.code : '', p.amount, p.method,
        p.date, p.note || '', p.receivedBy || ''
      ];
    }
  ));

  put_(ss, 'Personel', headRows_(
    ['id', 'ad', 'rol', 'departman', 'vardiya', 'telefon', 'email', 'maas', 'kullaniciAdi', 'aktif', 'iseGiris'],
    staff,
    function (s) {
      return [
        s.id, s.name, s.role, s.department, s.shift, s.phone, s.email,
        s.salary || 0, s.username || '', s.active ? 'EVET' : 'HAYIR', s.hiredAt || ''
      ];
    }
  ));

  put_(ss, 'Muhasebe', headRows_(
    [
      'id', 'tarih', 'saat', 'tip', 'kategori', 'aciklama', 'tutar', 'yontem',
      'hesap', 'karsiTaraf', 'referans', 'personelId', 'rezervasyonId', 'odemeId',
      'kdv', 'not', 'kaydeden', 'olusturma'
    ],
    ledger,
    function (e) {
      return [
        e.id, e.date, e.time || '', e.type, e.category, e.description, e.amount, e.method,
        e.account || '', e.counterparty || '', e.reference || '', e.staffId || '',
        e.reservationId || '', e.paymentId || '', e.vatRate || '', e.notes || '',
        e.createdBy || '', e.createdAt || ''
      ];
    }
  ));

  put_(ss, 'Faturalar', headRows_(
    [
      'id', 'rezervasyonId', 'rezervasyonKod', 'tetik', 'tutar', 'durum', 'sorumlu',
      'sorumluId', 'faturaNo', 'dosya', 'drive', 'olusturma', 'sonTarih', 'kesim', 'not'
    ],
    invoices,
    function (inv) {
      var r = byId_(data.reservations, inv.reservationId);
      return [
        inv.id, inv.reservationId, r ? r.code : '', inv.trigger, inv.amount, inv.status,
        inv.responsibleName, inv.responsibleStaffId, inv.invoiceNumber || '',
        inv.fileName || '', inv.driveUrl || '', inv.createdAt || '', inv.dueAt || '',
        inv.issuedAt || '', inv.notes || ''
      ];
    }
  ));

  put_(ss, 'Gorevler', headRows_(
    ['id', 'odaId', 'odaNo', 'tip', 'durum', 'oncelik', 'atanan', 'not', 'olusturma', 'bitis'],
    tasks,
    function (tk) {
      var room = byId_(data.rooms, tk.roomId);
      var st = byId_(data.staff, tk.assignedTo);
      return [
        tk.id, tk.roomId, room ? room.number : '', tk.type, tk.status, tk.priority,
        st ? st.name : (tk.assignedTo || ''), tk.notes || '',
        tk.createdAt || '', tk.completedAt || ''
      ];
    }
  ));

  put_(ss, 'ZorunluGiderler', headRows_(
    ['id', 'ad', 'kategori', 'tutar', 'gun', 'aktif', 'sonUretim', 'not'],
    recurring,
    function (r) {
      return [
        r.id, r.name, r.category, r.amount, r.dayOfMonth,
        r.active ? 'EVET' : 'HAYIR', r.lastGenerated || '', r.notes || ''
      ];
    }
  ));
}

function active_(arr) {
  var o = [];
  var L = arr || [];
  var i;
  for (i = 0; i < L.length; i++) {
    if (L[i] && !L[i].deletedAt) {
      o.push(L[i]);
    }
  }
  return o;
}

function byId_(arr, id) {
  if (!id || !arr) {
    return null;
  }
  var i;
  for (i = 0; i < arr.length; i++) {
    if (arr[i] && arr[i].id === id) {
      return arr[i];
    }
  }
  return null;
}

function join_(a) {
  if (!a || !a.length) {
    return '';
  }
  return a.join('; ');
}

function headRows_(h, list, fn) {
  var rows = [h];
  var i;
  var c;
  for (i = 0; i < list.length; i++) {
    var row = fn(list[i]);
    for (c = 0; c < row.length; c++) {
      if (row[c] === undefined || row[c] === null) {
        row[c] = '';
      }
    }
    rows.push(row);
  }
  return rows;
}

function put_(ss, name, rows) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  sh.clearContents();
  if (!rows || !rows.length) {
    return;
  }
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.setFrozenRows(1);
}

function ver_() {
  return Number(PROP.getProperty('version') || 0);
}

function now_() {
  return new Date().toISOString();
}

/** JSON veya JSONP (callback varsa CORS yok) */
function out_(obj, e) {
  var json = JSON.stringify(obj);
  var cb = '';
  if (e && e.parameter && e.parameter.callback) {
    cb = String(e.parameter.callback);
  }
  // callback adini guvenli tut
  if (cb && /^[A-Za-z0-9_]+$/.test(cb)) {
    return ContentService
      .createTextOutput(cb + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('UYU ROOM')
    .addItem('Sheet tablolarini yaz', 'menuRewrite')
    .addItem('Surum', 'menuInfo')
    .addToUi();
}

function menuRewrite() {
  var r = rewriteOnly_();
  SpreadsheetApp.getUi().alert(r.ok ? r.message : ('Hata: ' + r.error));
}

function menuInfo() {
  SpreadsheetApp.getUi().alert(
    'v' + ver_() + '\n' +
    (PROP.getProperty('updatedAt') || '-') + '\n' +
    (PROP.getProperty('updatedBy') || '-')
  );
}
