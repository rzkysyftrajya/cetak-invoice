const APP_CONFIG = Object.freeze({

  timezone: 'Asia/Jakarta',

  headerRow: 6,

  firstDataRow: 7,

  maxDataRow: 1000,

  sheets: {

    dashboard: 'Dashboard',

    cars: 'Data Mobil',

    rentals: 'Transaksi Rental',

    refs: 'Referensi'

  }

});

const HEADERS = Object.freeze({

  cars: [

    'ID Mobil', 'Nama Mobil', 'Nomor Polisi', 'Merek', 'Tipe / Model',

    'Tahun', 'Warna', 'Transmisi', 'Kapasitas', 'Status', 'KM Sekarang',

    'Pajak Tahunan', 'STNK 5 Tahunan', 'Asuransi', 'Harga Sewa / Hari',

    'Total Pemasukan', 'Total Biaya', 'Laba Bersih', 'Status Pajak', 'Catatan'

  ],

  rentals: [

    'Tanggal Catat', 'ID Booking', 'ID Mobil', 'Nama Mobil', 'Nama Pelanggan',

    'No. WhatsApp', 'Tanggal Mulai', 'Tanggal Selesai', 'Durasi (Hari)',

    'Layanan', 'Tujuan / Rute', 'Harga / Hari', 'Deposit', 'Total Tagihan',

    'Sudah Dibayar', 'Sisa Bayar', 'Status Pembayaran', 'Status Booking', 'Catatan', 'Mode Sewa', 'Jam Mulai', 'Jam Selesai', 'Operasional Driver'

  ]

});

function doGet() {

  return HtmlService.createTemplateFromFile('Index')

    .evaluate()

    .setTitle('Manajemen Armada Mobil')

    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')

    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

}

function onOpen() {

  SpreadsheetApp.getUi()

    .createMenu('Manajemen Mobil')

    .addItem('Siapkan / Perbaiki Sheet', 'setupAplikasi')

    .addItem('Segarkan Rumus', 'pasangSemuaRumus')

    .addToUi();

}

function setupAplikasi() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ss.setSpreadsheetTimeZone(APP_CONFIG.timezone);

  const cars = ensureSheet_(ss, APP_CONFIG.sheets.cars, HEADERS.cars);

  const rentals = prepareRentalSheet_(ss);

  ensureReferenceSheet_(ss);

  styleHeader_(cars, HEADERS.cars.length);

  styleHeader_(rentals, HEADERS.rentals.length);

  pasangSemuaRumus();

  pasangValidasi_();

  return {

    ok: true,

    message: 'Sheet rental berhasil diperbarui. Kolom Deposit dan fitur edit sudah siap.'

  };

}

function getDataAwal(selectedMonth) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const carsSheet = ensureSheet_(ss, APP_CONFIG.sheets.cars, HEADERS.cars);

  const rentalSheet = prepareRentalSheet_(ss);

  const carsRows = getRows_(carsSheet, HEADERS.cars.length);

  const rentalRows = getRows_(rentalSheet, HEADERS.rentals.length);

  const periodKey = normalizeMonthKey_(selectedMonth);

  const cars = carsRows.map(row => ({

    id: text_(row[0]),

    name: text_(row[1]),

    plate: text_(row[2]),

    brand: text_(row[3]),

    model: text_(row[4]),

    status: text_(row[9]),

    km: number_(row[10]),

    taxDate: isoDate_(row[11]),

    dailyRate: number_(row[14])

  }));

  const periodRentals = rentalRows.filter(row => {

    const rentalDate = date_(row[6]) || date_(row[0]);

    return monthKey_(rentalDate) === periodKey;

  });

  const validRentals = periodRentals.filter(row => {

    const paymentStatus = text_(row[16]);

    const bookingStatus = text_(row[17]);

    return paymentStatus !== 'Dibatalkan' &&

      bookingStatus !== 'Dibatalkan' &&

      bookingStatus !== 'No Show';

  });

  // Gunakan nilai formula bila benar; hitung ulang bila formula sheet kosong/0.
  function rentalAmounts_(row) {
    const start = date_(row[6]);
    const end = date_(row[7]);
    let duration = number_(row[8]);
    if ((text_(row[19]) === '24jam' || !duration || duration < 1) && start && end && end >= start) {
      const begin = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const finish = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const calendarDays = Math.round((finish - begin) / 86400000) + 1;
      if (text_(row[19]) === '24jam') {
        const timeMinutes = value => {
          if (typeof value === 'number') return Math.round(value * 1440);
          if (value instanceof Date) return value.getHours() * 60 + value.getMinutes();
          const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
          return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
        };
        const minutes = (calendarDays - 1) * 1440 + timeMinutes(row[21]) - timeMinutes(row[20]);
        duration = Math.max(1, Math.ceil(minutes / 1440));
      } else duration = Math.max(1, calendarDays);
    }
    const rate = Math.max(0, number_(row[11]));
    const savedTotal = Math.max(0, number_(row[13]));
    const total = text_(row[19]) === '24jam' && rate > 0 ? Math.max(0, duration * rate) : (savedTotal > 0 ? savedTotal : Math.max(0, duration * rate));
    const paid = Math.max(0, number_(row[14]));
    const remaining = Math.max(0, total - paid);
    return { duration, total, paid, remaining };
  }

  const monthlyTotals = validRentals.reduce((result, row) => {

    const amounts = rentalAmounts_(row);
    const total = amounts.total;
    const remaining = amounts.remaining;
    const rentalReceived = Math.min(total, amounts.paid);

    result.income += total;

    result.profit += rentalReceived - number_(row[22]);

    result.deposit += number_(row[12]);

    result.remaining += remaining;

    if (text_(row[17]) === 'Selesai') result.completed += 1;

    return result;

  }, { income: 0, profit: 0, deposit: 0, remaining: 0, completed: 0 });

  const dashboard = {

    periodKey,

    periodLabel: monthLabel_(periodKey),

    totalCars: cars.length,

    available: cars.filter(car => car.status === 'Tersedia').length,

    rented: cars.filter(car => car.status === 'Disewa').length,

    rentalCount: validRentals.length,

    completed: monthlyTotals.completed,

    income: monthlyTotals.income,

    profit: monthlyTotals.profit,

    deposit: monthlyTotals.deposit,

    remaining: monthlyTotals.remaining,

    dueTax: carsRows.filter(row => {

      const due = date_(row[11]);

      return monthKey_(due) === periodKey;

    }).length

  };

  const unitRentals = periodRentals.map(row => {
    const amounts = rentalAmounts_(row);
    return ({

    date: isoDate_(row[0]),

    bookingId: text_(row[1]),

    carId: text_(row[2]),

    carName: text_(row[3]),

    customer: text_(row[4]),

    whatsapp: text_(row[5]),

    start: isoDate_(row[6]),

    end: isoDate_(row[7]),

    duration: amounts.duration,

    service: text_(row[9]),

    route: text_(row[10]),

    dailyRate: number_(row[11]),

    deposit: number_(row[12]),

    total: amounts.total,

    paid: amounts.paid,

    remaining: amounts.remaining,

    paymentStatus: text_(row[16]),

    bookingStatus: text_(row[17]),

    notes: text_(row[18]),
    rentalMode: text_(row[19]) || 'kalender',
    startTime: timeText_(row[20]),
    endTime: timeText_(row[21]),
    driverCost: number_(row[22])

  });
  });

  const recentRentals = unitRentals.slice(-20).reverse();

  return { ok: true, periodKey, dashboard, cars, recentRentals, unitRentals };

}

function simpanMobil(payload) {

  return withLock_(function () {

    const data = payload || {};

    if (!text_(data.name)) throw new Error('Nama mobil wajib diisi.');

    if (!text_(data.plate)) throw new Error('Nomor polisi wajib diisi.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const sheet = ensureSheet_(ss, APP_CONFIG.sheets.cars, HEADERS.cars);

    const row = findWritableRow_(sheet, 1);

    const id = nextCarId_(sheet);

    sheet.getRange(row, 1, 1, 15).setValues([[

      id,

      text_(data.name),

      text_(data.plate).toUpperCase(),

      text_(data.brand),

      text_(data.model),

      nullableNumber_(data.year),

      text_(data.color),

      text_(data.transmission) || 'Matic',

      nullableNumber_(data.capacity),

      text_(data.status) || 'Tersedia',

      nullableNumber_(data.km),

      date_(data.taxDate),

      date_(data.stnkDate),

      date_(data.insuranceDate),

      number_(data.dailyRate)

    ]]);

    sheet.getRange(row, 20).setValue(text_(data.notes));

    setCarFormulas_(sheet, row);

    SpreadsheetApp.flush();

    return { ok: true, message: 'Data mobil berhasil disimpan.', id };

  });

}

function simpanRental(payload) {

  return withLock_(function () {

    const data = payload || {};

    const carId = text_(data.carId);

    const customer = text_(data.customer);

    const startDate = date_(data.startDate);

    const endDate = date_(data.endDate);

    if (!carId) throw new Error('Pilih mobil terlebih dahulu.');

    if (!customer) throw new Error('Nama pelanggan wajib diisi.');

    if (!startDate || !endDate) throw new Error('Tanggal mulai dan selesai wajib diisi.');

    if (endDate < startDate) throw new Error('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    const rentalMode = text_(data.rentalMode) === '24jam' ? '24jam' : 'kalender';
    const startTime = rentalMode === '24jam' ? validateTime_(data.startTime) : '';
    const endTime = rentalMode === '24jam' ? validateTime_(data.endTime) : '';
    if (rentalMode === '24jam' && (new Date(String(data.endDate).slice(0,10) + 'T' + endTime + ':00').getTime() <= new Date(String(data.startDate).slice(0,10) + 'T' + startTime + ':00').getTime())) throw new Error('Jam selesai harus setelah jam mulai.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const sheet = prepareRentalSheet_(ss);

    const requestedBookingId = text_(data.bookingId);

    const isEdit = Boolean(requestedBookingId);

    let row;

    let bookingId;

    let recordedAt = new Date();

    let oldCarId = '';

    let oldBookingStatus = '';

    if (isEdit) {

      row = findRowByValue_(sheet, 2, requestedBookingId);

      if (!row) throw new Error('Transaksi yang akan diedit tidak ditemukan. Segarkan halaman lalu coba lagi.');

      const oldRow = sheet.getRange(row, 1, 1, HEADERS.rentals.length).getValues()[0];

      bookingId = requestedBookingId;

      recordedAt = date_(oldRow[0]) || recordedAt;

      oldCarId = text_(oldRow[2]);

      oldBookingStatus = text_(oldRow[17]);

    } else {

      row = findWritableRow_(sheet, 2);

      bookingId = timestampId_('BOOK');

    }

    ['dailyRate', 'deposit', 'paid', 'driverCost'].forEach(field => {
      const amount = number_(data[field]);
      if (amount < 0 || amount > 10000000000) {
        throw new Error('Nominal ' + field + ' tidak wajar. Periksa angka Rupiah sebelum menyimpan.');
      }
    });

    const bookingStatus = text_(data.bookingStatus) || 'Booking';

    const values = [[

      recordedAt,

      bookingId,

      carId,

      '',

      customer,

      text_(data.whatsapp),

      startDate,

      endDate,

      '',

      text_(data.service) || 'Dengan Sopir',

      text_(data.route),

      number_(data.dailyRate),

      number_(data.deposit),

      '',

      number_(data.paid),

      '',

      text_(data.paymentStatus) || 'Belum Bayar',

      bookingStatus,

      text_(data.notes),
      rentalMode, startTime, endTime, Math.max(0, number_(data.driverCost))
    ]];

    sheet.getRange(row, 1, 1, HEADERS.rentals.length).setValues(values);

    if (rentalMode === '24jam') {
      sheet.getRange(row,21,1,2).setValues([[timeFraction_(startTime),timeFraction_(endTime)]]).setNumberFormat('hh:mm');
    } else { sheet.getRange(row,21,1,2).clearContent(); }
    setRentalFormulas_(sheet, row);

    if (isEdit && oldCarId && oldBookingStatus === 'Berjalan' &&

        (oldCarId !== carId || bookingStatus !== 'Berjalan')) {

      updateCarStatus_(ss, oldCarId, 'Tersedia');

    }

    if (bookingStatus === 'Berjalan') {

      updateCarStatus_(ss, carId, 'Disewa');

    } else if (bookingStatus === 'Selesai' || bookingStatus === 'Dibatalkan' || bookingStatus === 'No Show') {

      updateCarStatus_(ss, carId, 'Tersedia');

    }

    SpreadsheetApp.flush();

    return {

      ok: true,

      message: isEdit ? 'Transaksi rental berhasil diperbarui.' : 'Transaksi rental berhasil disimpan.',

      bookingId

    };

  });

}

function ubahStatusMobil(carId, status) {

  const allowed = ['Tersedia', 'Disewa', 'Tidak Aktif', 'Terjual'];

  if (allowed.indexOf(status) === -1) throw new Error('Status mobil tidak valid.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!updateCarStatus_(ss, text_(carId), status)) {

    throw new Error('ID mobil tidak ditemukan.');

  }

  return { ok: true, message: 'Status mobil berhasil diperbarui.' };

}

function pasangSemuaRumus() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const cars = ensureSheet_(ss, APP_CONFIG.sheets.cars, HEADERS.cars);

  const rentals = prepareRentalSheet_(ss);

  setCarFormulasAll_(cars);

  setRentalFormulasAll_(rentals);

  SpreadsheetApp.flush();

  return { ok: true, message: 'Semua rumus sudah dipasang.' };

}

function setCarFormulas_(sheet, row) {

  sheet.getRange(row, 16, 1, 4).setFormulas([[

    `=IF(A${row}="","",SUMIFS('Transaksi Rental'!$N$7:$N$1000,'Transaksi Rental'!$C$7:$C$1000,A${row},'Transaksi Rental'!$R$7:$R$1000,"<>Dibatalkan"))`,

    `=IF(A${row}="","",SUMIFS('Transaksi Rental'!$W$7:$W$1000,'Transaksi Rental'!$C$7:$C$1000,A${row},'Transaksi Rental'!$R$7:$R$1000,"<>Dibatalkan"))`,

    `=IF(A${row}="","",P${row}-Q${row})`,

    `=IF(A${row}="","",IF(L${row}="","Belum diisi",IF(L${row}<TODAY(),"TERLAMBAT",IF(L${row}<=TODAY()+30,"Segera jatuh tempo","Aman"))))`

  ]]);

}

function setCarFormulasAll_(sheet) {

  const formulas = [];

  for (let row = APP_CONFIG.firstDataRow; row <= APP_CONFIG.maxDataRow; row++) {

    formulas.push([

      `=IF(A${row}="","",SUMIFS('Transaksi Rental'!$N$7:$N$1000,'Transaksi Rental'!$C$7:$C$1000,A${row},'Transaksi Rental'!$R$7:$R$1000,"<>Dibatalkan"))`,

      `=IF(A${row}="","",SUMIFS('Transaksi Rental'!$W$7:$W$1000,'Transaksi Rental'!$C$7:$C$1000,A${row},'Transaksi Rental'!$R$7:$R$1000,"<>Dibatalkan"))`,

      `=IF(A${row}="","",P${row}-Q${row})`,

      `=IF(A${row}="","",IF(L${row}="","Belum diisi",IF(L${row}<TODAY(),"TERLAMBAT",IF(L${row}<=TODAY()+30,"Segera jatuh tempo","Aman"))))`

    ]);

  }

  sheet.getRange(APP_CONFIG.firstDataRow, 16, formulas.length, 4).setFormulas(formulas);

}

function setRentalFormulas_(sheet, row) {

  sheet.getRange(row, 4).setFormula(

    `=IF(C${row}="","",IFERROR(VLOOKUP(C${row},'Data Mobil'!$A$7:$B$1000,2,FALSE),"ID tidak ditemukan"))`

  );

  sheet.getRange(row, 9).setFormula(

    `=IF(OR(G${row}="",H${row}=""),"",IF(T${row}="24jam",IF(OR(U${row}="",V${row}=""),"",MAX(1,ROUNDUP((H${row}+V${row}-G${row}-U${row})*24/24,0))),MAX(1,INT(H${row})-INT(G${row})+1)))`

  );

  sheet.getRange(row, 14).setFormula(

    `=IF(OR(I${row}="",L${row}=""),"",MAX(0,I${row}*L${row}))`

  );

  sheet.getRange(row, 16).setFormula(

    `=IF(N${row}="","",MAX(0,N${row}-O${row}))`

  );

}

function setRentalFormulasAll_(sheet) {

  const carNames = [];

  const durations = [];

  const totals = [];

  const remaining = [];

  for (let row = APP_CONFIG.firstDataRow; row <= APP_CONFIG.maxDataRow; row++) {

    carNames.push([`=IF(C${row}="","",IFERROR(VLOOKUP(C${row},'Data Mobil'!$A$7:$B$1000,2,FALSE),"ID tidak ditemukan"))`]);

    durations.push([`=IF(OR(G${row}="",H${row}=""),"",IF(T${row}="24jam",IF(OR(U${row}="",V${row}=""),"",MAX(1,ROUNDUP((H${row}+V${row}-G${row}-U${row})*24/24,0))),MAX(1,INT(H${row})-INT(G${row})+1)))`]);

    totals.push([`=IF(OR(I${row}="",L${row}=""),"",MAX(0,I${row}*L${row}))`]);

    remaining.push([`=IF(N${row}="","",MAX(0,N${row}-O${row}))`]);

  }

  const count = carNames.length;

  sheet.getRange(APP_CONFIG.firstDataRow, 4, count, 1).setFormulas(carNames);

  sheet.getRange(APP_CONFIG.firstDataRow, 9, count, 1).setFormulas(durations);

  sheet.getRange(APP_CONFIG.firstDataRow, 14, count, 1).setFormulas(totals);

  sheet.getRange(APP_CONFIG.firstDataRow, 16, count, 1).setFormulas(remaining);

}

function prepareRentalSheet_(ss) {

  let sheet = ss.getSheetByName(APP_CONFIG.sheets.rentals);

  if (!sheet) sheet = ss.insertSheet(APP_CONFIG.sheets.rentals);

  ensureSize_(sheet, APP_CONFIG.maxDataRow, 23);

  const oldHeaders = sheet.getRange(APP_CONFIG.headerRow, 1, 1, 20).getDisplayValues()[0].map(text_);

  const usesOldColumns = oldHeaders[12] === 'Biaya Tambahan' || oldHeaders[13] === 'Diskon';

  if (usesOldColumns) {

    const lastRow = Math.min(sheet.getLastRow(), APP_CONFIG.maxDataRow);

    if (lastRow >= APP_CONFIG.firstDataRow) {

      const count = lastRow - APP_CONFIG.firstDataRow + 1;

      const oldRows = sheet.getRange(APP_CONFIG.firstDataRow, 1, count, 20).getValues();

      const migratedRows = oldRows.map(row => [

        row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8],

        row[9], row[10], row[11],

        row[13],

        row[14], row[15], row[16], row[17], row[18], row[19]

      ]);

      sheet.getRange(APP_CONFIG.firstDataRow, 1, count, HEADERS.rentals.length).setValues(migratedRows);

      sheet.getRange(APP_CONFIG.firstDataRow, 20, count, 1).clearContent();

    }

  }

  sheet.getRange(APP_CONFIG.headerRow, 1, 1, HEADERS.rentals.length).setValues([HEADERS.rentals]);

  sheet.getRange(APP_CONFIG.headerRow, 20, 1, 4).setValues([HEADERS.rentals.slice(19)]);
  sheet.getRange(APP_CONFIG.firstDataRow, 21, APP_CONFIG.maxDataRow-APP_CONFIG.firstDataRow+1, 2).setNumberFormat('hh:mm');

  sheet.setFrozenRows(APP_CONFIG.headerRow);

  if (usesOldColumns) {

    setRentalFormulasAll_(sheet);

    SpreadsheetApp.flush();

  }

  return sheet;

}

function ensureSheet_(ss, name, headers) {

  let sheet = ss.getSheetByName(name);

  if (!sheet) sheet = ss.insertSheet(name);

  ensureSize_(sheet, APP_CONFIG.maxDataRow, headers.length);

  const headerRange = sheet.getRange(APP_CONFIG.headerRow, 1, 1, headers.length);

  const current = headerRange.getDisplayValues()[0].join('').trim();

  if (!current) headerRange.setValues([headers]);

  sheet.setFrozenRows(APP_CONFIG.headerRow);

  return sheet;

}

function ensureSize_(sheet, minRows, minColumns) {

  if (sheet.getMaxRows() < minRows) {

    sheet.insertRowsAfter(sheet.getMaxRows(), minRows - sheet.getMaxRows());

  }

  if (sheet.getMaxColumns() < minColumns) {

    sheet.insertColumnsAfter(sheet.getMaxColumns(), minColumns - sheet.getMaxColumns());

  }

}

function ensureReferenceSheet_(ss) {

  let sheet = ss.getSheetByName(APP_CONFIG.sheets.refs);

  if (!sheet) sheet = ss.insertSheet(APP_CONFIG.sheets.refs);

  ensureSize_(sheet, 10, 6);

  const values = [

    ['Status Mobil', 'Transmisi', 'Layanan', 'Status Pembayaran', 'Status Booking'],

    ['Tersedia', 'Matic', 'Dengan Sopir', 'Belum Bayar', 'Booking'],

    ['Disewa', 'Manual', 'Lepas Kunci', 'DP', 'Berjalan'],

    ['Tidak Aktif', 'Lainnya', 'Antar Jemput Bandara', 'Lunas', 'Selesai'],

    ['Terjual', '', 'RtR', 'Dibatalkan', 'Dibatalkan'],

    ['', '', 'Luar Kota', '', 'No Show'],

    ['', '', 'Lainnya', '', '']

  ];

  sheet.getRange(1, 1, 10, 6).clearContent();

  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);

  styleHeader_(sheet, values[0].length, 1);

  return sheet;

}

function styleHeader_(sheet, width, row) {

  const headerRow = row || APP_CONFIG.headerRow;

  sheet.getRange(headerRow, 1, 1, width)

    .setBackground('#17365D')

    .setFontColor('#FFFFFF')

    .setFontWeight('bold')

    .setHorizontalAlignment('center')

    .setVerticalAlignment('middle')

    .setWrap(true);

}

function pasangValidasi_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const refs = ss.getSheetByName(APP_CONFIG.sheets.refs) || ensureReferenceSheet_(ss);

  const cars = ensureSheet_(ss, APP_CONFIG.sheets.cars, HEADERS.cars);

  const rentals = prepareRentalSheet_(ss);

  const rows = APP_CONFIG.maxDataRow - APP_CONFIG.firstDataRow + 1;

  cars.getRange(APP_CONFIG.firstDataRow, 8, rows, 1).setDataValidation(

    SpreadsheetApp.newDataValidation().requireValueInRange(refs.getRange('B2:B4'), true).build()

  );

  cars.getRange(APP_CONFIG.firstDataRow, 10, rows, 1).setDataValidation(

    SpreadsheetApp.newDataValidation().requireValueInRange(refs.getRange('A2:A5'), true).build()

  );

  rentals.getRange(APP_CONFIG.firstDataRow, 3, rows, 1).setDataValidation(

    SpreadsheetApp.newDataValidation().requireValueInRange(cars.getRange('A7:A1000'), true).build()

  );

  rentals.getRange(APP_CONFIG.firstDataRow, 10, rows, 1).setDataValidation(

    SpreadsheetApp.newDataValidation().requireValueInRange(refs.getRange('C2:C7'), true).build()

  );

  rentals.getRange(APP_CONFIG.firstDataRow, 17, rows, 1).setDataValidation(

    SpreadsheetApp.newDataValidation().requireValueInRange(refs.getRange('D2:D5'), true).build()

  );

  rentals.getRange(APP_CONFIG.firstDataRow, 18, rows, 1).setDataValidation(

    SpreadsheetApp.newDataValidation().requireValueInRange(refs.getRange('E2:E6'), true).build()

  );

}

function getRows_(sheet, width) {

  const first = APP_CONFIG.firstDataRow;

  const last = Math.min(Math.max(sheet.getLastRow(), first), APP_CONFIG.maxDataRow);

  if (last < first) return [];

  return sheet.getRange(first, 1, last - first + 1, width)

    .getValues()

    .filter(row => text_(row[0]) || text_(row[1]));

}

function findWritableRow_(sheet, keyColumn) {

  const first = APP_CONFIG.firstDataRow;

  const count = APP_CONFIG.maxDataRow - first + 1;

  const values = sheet.getRange(first, keyColumn, count, 1).getDisplayValues();

  const index = values.findIndex(row => !text_(row[0]));

  if (index === -1) throw new Error('Kapasitas sheet sudah penuh. Tambahkan baris baru.');

  return first + index;

}

function findRowByValue_(sheet, column, value) {

  const first = APP_CONFIG.firstDataRow;

  const count = APP_CONFIG.maxDataRow - first + 1;

  const values = sheet.getRange(first, column, count, 1).getDisplayValues();

  const target = text_(value);

  const index = values.findIndex(row => text_(row[0]) === target);

  return index === -1 ? 0 : first + index;

}

function nextCarId_(sheet) {

  const rows = getRows_(sheet, HEADERS.cars.length);

  let max = 0;

  rows.forEach(row => {

    const match = text_(row[0]).match(/(\d+)$/);

    if (match) max = Math.max(max, Number(match[1]));

  });

  return `MOB-${String(max + 1).padStart(3, '0')}`;

}

function timestampId_(prefix) {

  const stamp = Utilities.formatDate(new Date(), APP_CONFIG.timezone, 'yyyyMMdd-HHmmss');

  return `${prefix}-${stamp}-${Utilities.getUuid().slice(0, 4).toUpperCase()}`;

}

function updateCarStatus_(ss, carId, status) {

  const sheet = ss.getSheetByName(APP_CONFIG.sheets.cars);

  if (!sheet || !carId) return false;

  const count = APP_CONFIG.maxDataRow - APP_CONFIG.firstDataRow + 1;

  const ids = sheet.getRange(APP_CONFIG.firstDataRow, 1, count, 1).getDisplayValues();

  const index = ids.findIndex(row => text_(row[0]) === carId);

  if (index === -1) return false;

  sheet.getRange(APP_CONFIG.firstDataRow + index, 10).setValue(status);

  return true;

}

function withLock_(callback) {

  const lock = LockService.getDocumentLock();

  lock.waitLock(30000);

  try {

    return callback();

  } finally {

    lock.releaseLock();

  }

}

function text_(value) {

  return value === null || value === undefined ? '' : String(value).trim();

}

function number_(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return 0;
  // 400.000 => 400000; 400000 => 400000; 400000.5 => 400000.5.
  const clean = raw.replace(/\s/g, '').replace(/^Rp\s*/i, '');
  if (/^-?\d+(?:\.\d{3})+(?:,\d+)?$/.test(clean)) {
    return Number(clean.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (/^-?\d+(?:,\d{3})+(?:\.\d+)?$/.test(clean)) {
    return Number(clean.replace(/,/g, '')) || 0;
  }
  if (/^-?\d+(?:[.,]\d+)?$/.test(clean)) {
    return Number(clean.replace(',', '.')) || 0;
  }
  return 0; // Sel lama yang berisi teks bukan nominal tidak boleh menggagalkan dashboard.
}

function nullableNumber_(value) {

  return text_(value) === '' ? '' : number_(value);

}

function date_(value) {

  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return value;

  const parsed = new Date(value);

  return isNaN(parsed) ? '' : parsed;

}

function isoDate_(value) {

  const parsed = date_(value);

  return parsed ? Utilities.formatDate(parsed, APP_CONFIG.timezone, 'yyyy-MM-dd') : '';

}

function monthKey_(value) {

  const parsed = date_(value);

  return parsed ? Utilities.formatDate(parsed, APP_CONFIG.timezone, 'yyyy-MM') : '';

}

function normalizeMonthKey_(value) {

  const candidate = text_(value);

  const match = /^(\d{4})-(\d{2})$/.exec(candidate);

  if (match) {

    const month = Number(match[2]);

    if (month >= 1 && month <= 12) return `${match[1]}-${match[2]}`;

  }

  return Utilities.formatDate(new Date(), APP_CONFIG.timezone, 'yyyy-MM');

}

function monthLabel_(key) {

  const months = [

    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',

    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'

  ];

  const parts = normalizeMonthKey_(key).split('-');

  return `${months[Number(parts[1]) - 1]} ${parts[0]}`;

}

function startOfDay_(value) {

  const d = new Date(value);

  d.setHours(0, 0, 0, 0);

  return d;

}

function validateTime_(value) {
  const v = String(value || '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Error('Format jam wajib HH:mm.');
  return v;
}
function timeText_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, APP_CONFIG.timezone, 'HH:mm');
  if (typeof value === 'number') return String(Math.floor(value*24)%24).padStart(2,'0') + ':' + String(Math.round(value*1440)%60).padStart(2,'0');
  return String(value || '').slice(0,5);
}

function timeFraction_(value) {
  const p = value.split(':').map(Number);
  return (p[0]*60+p[1])/1440;
}

function gantiArmadaDenganKonfirmasi() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sh=ss.getSheetByName(APP_CONFIG.sheets.cars);
  if (!sh) throw new Error('Sheet Data Mobil tidak ditemukan.');
  const fleet=[['Innova Zenix G','BK 1034 AGO'],['Innova','BK 1849 AGA'],['Innova','BK 1614 AFG'],['Avanza','BK 1833 AGO'],['Avanza','BK 1695 AEW'],['Avanza','BK 1538 AGG'],['Avanza','BK 1226 AFS'],['Avanza','BK 1290 AHA'],['Agya','BK 1425 AFU'],['Fortuner GR','BK 1565 AEB']];
  const active=ss.getSheetByName(APP_CONFIG.sheets.rentals);
  if (active && getRows_(active,HEADERS.rentals.length).some(r=>r[2])) throw new Error('Ada transaksi lama. Penggantian ID mobil otomatis diblokir agar histori tidak rusak. Migrasikan ID terlebih dahulu.');
  sh.getRange(7,1,994,15).clearContent();
  fleet.forEach((v,i)=>sh.getRange(7+i,1,1,15).setValues([['MOB-'+String(i+1).padStart(3,'0'),v[0],v[1],'Toyota',v[0],'','','Matic','','Tersedia','','','','','']]));
  pasangSemuaRumus();
}

/** Jalankan SEKALI setelah backup untuk memperbaiki rumus transaksi yang sudah ada.
 * Tidak menghapus data mobil, transaksi, pembayaran, atau tampilan aplikasi.
 */
function perbaikiRumusTransaksiAman() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(APP_CONFIG.sheets.rentals);
  if (!sheet) throw new Error('Sheet Transaksi Rental tidak ditemukan.');
  const first = APP_CONFIG.firstDataRow;
  const last = Math.min(sheet.getLastRow(), APP_CONFIG.maxDataRow);
  if (last < first) return {ok:true, repaired:0};
  const ids = sheet.getRange(first, 2, last - first + 1, 1).getDisplayValues();
  let repaired = 0;
  ids.forEach((entry, index) => {
    if (!entry[0]) return;
    const r = first + index;
    sheet.getRange(r, 9).setFormula(`=IF(OR(G${r}="",H${r}=""),"",IF(T${r}="24jam",IF(OR(U${r}="",V${r}=""),"",MAX(1,ROUNDUP(H${r}+V${r}-G${r}-U${r},0))),MAX(1,INT(H${r})-INT(G${r})+1)))`);
    sheet.getRange(r, 14).setFormula(`=IF(OR(I${r}="",L${r}=""),"",MAX(0,I${r}*L${r}))`);
    sheet.getRange(r, 16).setFormula(`=IF(N${r}="","",MAX(0,N${r}-O${r}))`);
    repaired++;
  });
  SpreadsheetApp.flush();
  return {ok:true,repaired};
}

/** TEMPEL di akhir Code.gs. READ ONLY: tidak menulis sel atau menjalankan setup. */
function auditNominalRentalTanpaMengubahData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Transaksi Rental');
  if (!sheet) throw new Error('Sheet Transaksi Rental tidak ditemukan');
  const ids = ['BOOK-20261008-121738-BD1A', 'BOOK-20261008-123831-598C'];
  const last = Math.min(sheet.getLastRow(), 1000);
  const rows = last >= 7 ? sheet.getRange(7, 1, last - 6, 26).getValues() : [];
  const out = { spreadsheet: ss.getName(), spreadsheetId: ss.getId(), sheet: sheet.getName(), matches: [] };
  rows.forEach((r, i) => {
    if (!ids.includes(String(r[1]))) return;
    const index = 7 + i;
    const fields = {bookingId:r[1],carId:r[2],duration:r[8],rate:r[11],deposit:r[12],total:r[13],paid:r[14],remaining:r[15],mode:r[19],driverCost:r[22]};
    const formulas = {duration:sheet.getRange(index,9).getFormula(),total:sheet.getRange(index,14).getFormula(),remaining:sheet.getRange(index,16).getFormula()};
    out.matches.push({row:index,fields,formulas});
  });
  console.log(JSON.stringify(out, null, 2));
  return out;
}