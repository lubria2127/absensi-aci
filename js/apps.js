// ===============================================
// INISIALISASI FIREBASE CLOUD FIRESTORE
// ===============================================
const firebaseConfig = {
  apiKey: "AIzaSyA2UR2N2uKtU6MQUrRrl4PjP2H0EKwEAhU",
  authDomain: "absensi-aci.firebaseapp.com",
  projectId: "absensi-aci",
  storageBucket: "absensi-aci.firebasestorage.app",
  messagingSenderId: "678680412575",
  appId: "1:678680412575:web:d9a82aaac2116165b7fdaa",
  measurementId: "G-4VMHV7GG8M"
};

if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
}
const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;

// Store Absensi Data: { empId: { tgl: { in: "", out: "", status: "" } } }
let dataAbsensi = {};
let rawFingerLogs = {};
let importedFilesList = []; // Menyimpan daftar nama file yang sudah di-import
let dataAbsensiPerFile = {}; // Menyimpan data log spesifik per file: { "fileA.xls": { empId: { tgl: { in, out } } } }
let periodeText = ""; // Menyimpan teks periode misal "2026-07-15 ~ 2026-08-04"
let tglStartYear = 2026, tglStartMonth = 6; // Juni (0-indexed = 6) untuk 15 Juli
// Generating Tanggal Periode 15 s.d. 14
const listTanggal = [];
for(let i=15; i<=31; i++) listTanggal.push(i);
for(let i=1; i<=14; i++) listTanggal.push(i);

function initDataAbsensi() {
    if (typeof listKaryawan === 'undefined') return;
    listKaryawan.forEach(k => {
        if(!dataAbsensi[k.id]) dataAbsensi[k.id] = {};
        listTanggal.forEach(tgl => {
            if(!dataAbsensi[k.id][tgl]) {
                dataAbsensi[k.id][tgl] = { in: "", out: "", status: "" };
            }
        });
    });
}

function switchView(viewName) {
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(e => e.classList.remove('active'));

    const navItems = document.querySelectorAll('.nav-item');

    if(viewName === 'karyawan') {
        if(navItems[0]) navItems[0].classList.add('active');
        document.getElementById('viewKaryawan').classList.add('active');
        document.getElementById('pageTitle').innerText = "Data Karyawan";
        document.getElementById('headerActions').style.display = "block";
    } else if(viewName === 'absensi') {
        if(navItems[1]) navItems[1].classList.add('active');
        document.getElementById('viewAbsensi').classList.add('active');
        document.getElementById('pageTitle').innerText = "Absensi Karyawan";
        document.getElementById('headerActions').style.display = "none";
        renderAbsensiTable();
    } else if(viewName === 'laporan' || viewName === 'rekap') {
        if(navItems[2]) navItems[2].classList.add('active');
        document.getElementById('viewLaporan').classList.add('active');
        document.getElementById('pageTitle').innerText = "Rekap & Laporan";
        document.getElementById('headerActions').style.display = "none";
    } else if(viewName === 'tutorial') {
        if(navItems[3]) navItems[3].classList.add('active');
        document.getElementById('viewTutorial').classList.add('active');
        document.getElementById('pageTitle').innerText = "Panduan & Tutorial";
        document.getElementById('headerActions').style.display = "none";
    }
}

function renderKaryawanTable() {
    let filterVal = document.getElementById('filterDept').value;
    let tbody = document.getElementById('tblKaryawanBody');
    tbody.innerHTML = "";

    let filtered = listKaryawan.filter(k => filterVal === 'ALL' || k.dept === filterVal);

    filtered.forEach((k, idx) => {
        let bruto = (k.gapok || 0) + (k.tunj || 0);
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <!-- INPUT ANGKA UNTUK MENGUBAH URUTAN LANGSUNG -->
            <td>
                <input type="number" 
                       value="${idx + 1}" 
                       min="1" 
                       max="${filtered.length}" 
                       onchange="setPositionKaryawan(${k.id}, this.value)" 
                       style="width: 50px; text-align: center; border: 1px solid var(--border-color); border-radius: 6px; padding: 2px 4px; font-weight: 600; color: var(--pink-dark);"
                       title="Ketik nomor urut baru lalu tekan Enter/Klik di luar">
            </td>
            <td style="text-align:left; font-weight:600;">${k.nama}</td>
            <td>${k.jabatan}</td>
            <td>${k.finger}</td>
            <td>${k.jamIn}</td>
            <td>Rp ${(k.gapok || 0).toLocaleString('id-ID')}</td>
            <td>Rp ${(k.tunj || 0).toLocaleString('id-ID')}</td>
            <td><b>Rp ${bruto.toLocaleString('id-ID')}</b></td>
            <td>
                <button class="btn btn-blue" style="padding:4px 8px; font-size:11px;" onclick="openEditModal(${k.id})"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                <button class="btn" style="background:#ff7675; color:white; padding:4px 8px; font-size:11px;" onclick="deleteKaryawan(${k.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// FUNGSI PINDAH URUTAN SPESIFIK (DENGAN FIX PERGESERAN INDEKS)
function setPositionKaryawan(id, newPos) {
    let filterVal = document.getElementById('filterDept').value;
    let filtered = listKaryawan.filter(k => filterVal === 'ALL' || k.dept === filterVal);
    
    let currIdx = filtered.findIndex(k => k.id === id);
    if (currIdx === -1) return;

    let targetPos = parseInt(newPos);
    
    // Batasi input agar aman
    if (isNaN(targetPos) || targetPos < 1) targetPos = 1;
    if (targetPos > filtered.length) targetPos = filtered.length;

    let targetIdx = targetPos - 1;
    if (currIdx === targetIdx) return; // Tidak ada perubahan jika nomor sama

    let itemToMove = filtered[currIdx];

    // 1. Hapus item dari array utama
    let globalFromIdx = listKaryawan.findIndex(k => k.id === itemToMove.id);
    listKaryawan.splice(globalFromIdx, 1);

    // 2. Tentukan posisi sisip baru
    if (filterVal === 'ALL') {
        // Jika menampilkan semua karyawan, langsung sisipkan ke targetIdx
        listKaryawan.splice(targetIdx, 0, itemToMove);
    } else {
        // Jika sedang memfilter departemen spesifik
        let updatedFiltered = listKaryawan.filter(k => k.dept === filterVal);
        if (targetIdx >= updatedFiltered.length) {
            let lastInDept = updatedFiltered[updatedFiltered.length - 1];
            let globalInsertIdx = listKaryawan.findIndex(k => k.id === lastInDept.id) + 1;
            listKaryawan.splice(globalInsertIdx, 0, itemToMove);
        } else {
            let targetInFiltered = updatedFiltered[targetIdx];
            let globalInsertIdx = listKaryawan.findIndex(k => k.id === targetInFiltered.id);
            listKaryawan.splice(globalInsertIdx, 0, itemToMove);
        }
    }

    // 3. Simpan dan render ulang
    saveToLocalStorage();
    renderKaryawanTable();
}

function renderAbsensiTable() {
    // Tampilkan Periode jika ada
    let badge = document.getElementById('badgePeriode');
    let txt = document.getElementById('textPeriode');
    if (badge && txt) {
        if (periodeText && periodeText.trim() !== "") {
            txt.innerText = periodeText;
            badge.style.display = 'inline-flex';
        } else {
            txt.innerText = "-";
            badge.style.display = 'none'; // Sembunyikan jika periodeText kosong
        }
    }

    let filterDept = document.getElementById('filterAbsensiDept').value;
    let trTgl = document.getElementById('trHeaderTgl');
    let trInOut = document.getElementById('trHeaderInOut');
    
    trTgl.innerHTML = '<th rowspan="2">No</th><th rowspan="2">Nama Karyawan</th><th rowspan="2">Jam Kerja</th>';
    trInOut.innerHTML = '';

    listTanggal.forEach(tgl => {
        // Deteksi Hari (Sabtu / Minggu)
        // Tanggal 15-31 pakai bulan pertama, Tanggal 1-14 pakai bulan berikutnya
        let monthOffset = (tgl >= 15) ? 0 : 1;
        let dateObj = new Date(tglStartYear, tglStartMonth + monthOffset, tgl);
        let dayOfWeek = dateObj.getDay(); // 0 = Minggu, 6 = Sabtu

        let dayClass = "";
        if (dayOfWeek === 6) dayClass = "col-sabtu";
        else if (dayOfWeek === 0) dayClass = "col-minggu";

        let thTgl = document.createElement('th');
        thTgl.colSpan = 3;
        if (dayClass) thTgl.classList.add(dayClass);
        thTgl.innerText = `Tgl ${tgl}`;
        trTgl.appendChild(thTgl);

        trInOut.innerHTML += `
            <th class="${dayClass}">IN</th>
            <th class="${dayClass}">OUT</th>
            <th class="${dayClass}">TELAT</th>
        `;
    });

    let tbody = document.getElementById('tblAbsensiBody');
    tbody.innerHTML = "";

    let filteredKaryawan = listKaryawan.filter(k => filterDept === 'ALL' || k.dept === filterDept);

    filteredKaryawan.forEach((k, idx) => {
        let tr = document.createElement('tr');
        let html = `<td>${idx+1}</td><td style="text-align:left; font-weight:600;">${k.nama}</td><td>${k.jamIn}</td>`;

        listTanggal.forEach(tgl => {
            let monthOffset = (tgl >= 15) ? 0 : 1;
            let dateObj = new Date(tglStartYear, tglStartMonth + monthOffset, tgl);
            let dayOfWeek = dateObj.getDay();

            let dayClass = "";
            if (dayOfWeek === 6) dayClass = "col-sabtu";
            else if (dayOfWeek === 0) dayClass = "col-minggu";

            let d = (dataAbsensi[k.id] && dataAbsensi[k.id][tgl]) ? dataAbsensi[k.id][tgl] : { in:"", out:"", status:"" };
            let lateStr = hitungTelat(d.in, k.jamIn);

            if(d.status) {
                html += `
                    <td colspan="3" class="cell-status-merged ${dayClass}">
                        <select onchange="updateStatusManual(${k.id}, ${tgl}, this.value)" style="font-weight:bold; color:#d63031;">
                            <option value="${d.status}" selected>-- ${d.status} --</option>
                            <option value="">(Reset Normal IN/OUT)</option>
                            <option value="SURAT DOKTER">SURAT DOKTER</option>
                            <option value="SAKIT">SAKIT</option>
                            <option value="IZIN">IZIN</option>
                            <option value="ALFA">ALFA</option>
                            <option value="CUTI">CUTI</option>
                            <option value="LUAR KOTA">LUAR KOTA</option>
                            <option value="GANTI HARI">GANTI HARI</option>
                            <option value="OFF">OFF</option>
                        </select>
                    </td>`;
            } else {
                html += `
                    <td class="${dayClass}"><input type="text" value="${d.in || ''}" placeholder="IN" style="width:40px;" onchange="updateAbsenCell(${k.id}, ${tgl}, 'in', this.value)"></td>
                    <td class="${dayClass}"><input type="text" value="${d.out || ''}" placeholder="OUT" style="width:40px;" onchange="updateAbsenCell(${k.id}, ${tgl}, 'out', this.value)"></td>
                    <td class="${dayClass}" style="font-size:11px; color:#d63031;">
                        ${lateStr ? lateStr : `<select onchange="updateStatusManual(${k.id}, ${tgl}, this.value)" style="font-size:10px; color:#8c7b83;">
                            <option value="">-</option>
                            <option value="SURAT DOKTER">SURAT DOKTER</option>
                            <option value="SAKIT">SAKIT</option>
                            <option value="IZIN">IZIN</option>
                            <option value="ALFA">ALFA</option>
                            <option value="CUTI">CUTI</option>
                            <option value="LUAR KOTA">LUAR KOTA</option>
                            <option value="GANTI HARI">GANTI HARI</option>
                            <option value="OFF">OFF</option>
                        </select>`}
                    </td>
                `;
            }
        });

        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

function hitungTelat(jamIn, stdIn) {
    if(!jamIn || jamIn.length < 5) return "";
    let [inH, inM] = jamIn.split(':').map(Number);
    let [stdH, stdM] = stdIn.split(':').map(Number);

    let totalIn = inH * 60 + inM;
    let totalStd = stdH * 60 + stdM;

    // Jika masuk tepat waktu atau lebih awal
    if(totalIn <= totalStd) return "00:00";

    // Hitung selisih keterlambatan (tanpa toleransi)
    let diff = totalIn - totalStd;

    // Pengurangan otomatis 1 jam jika melewati jam istirahat siang (12:00 - 13:00)
    if(totalIn > 12 * 60) {
        let deduct = Math.min(60, Math.max(0, Math.min(totalIn, 13 * 60) - 12 * 60));
        diff -= deduct;
    }

    let h = Math.floor(diff / 60);
    let m = diff % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function updateAbsenCell(empId, tgl, key, val) {
    if(!dataAbsensi[empId]) dataAbsensi[empId] = {};
    if(!dataAbsensi[empId][tgl]) dataAbsensi[empId][tgl] = { in:"", out:"", status:"" };
    
    let upper = val.toUpperCase();
    if(["SAKIT", "IZIN", "CUTI", "OFF", "JKT", "WFH", "ALFA"].includes(upper)) {
        dataAbsensi[empId][tgl].status = upper;
    } else {
        dataAbsensi[empId][tgl][key] = val;
    }
    renderAbsensiTable();
    saveToLocalStorage();
}

function updateStatusManual(empId, tgl, val) {
    if(!dataAbsensi[empId]) dataAbsensi[empId] = {};
    if(!dataAbsensi[empId][tgl]) dataAbsensi[empId][tgl] = { in:"", out:"", status:"" };

    dataAbsensi[empId][tgl].status = val;
    if(val === "") {
        dataAbsensi[empId][tgl].in = "";
        dataAbsensi[empId][tgl].out = "";
    }
    renderAbsensiTable();
    saveToLocalStorage();
}

// MEMETAKAN ULANG LOG SECARA INTERAKTIF KE KARYAWAN AKTIF
function remapAbsensiDariRawLogs() {
    // 1. Reset jam masuk & keluar di dataAbsensi, tapi biarkan status manual (Sakit, Cuti, dll)
    listKaryawan.forEach(k => {
        if (!dataAbsensi[k.id]) dataAbsensi[k.id] = {};
        listTanggal.forEach(tgl => {
            if (!dataAbsensi[k.id][tgl]) {
                dataAbsensi[k.id][tgl] = { in: "", out: "", status: "" };
            } else {
                dataAbsensi[k.id][tgl].in = "";
                dataAbsensi[k.id][tgl].out = "";
            }
        });
    });

    // 2. Cocokkan raw scan log ke karyawan berdasarkan finger aktif
    Object.keys(rawFingerLogs).forEach(fName => {
        let fUpper = fName.trim().toUpperCase();
        // Cocokkan hanya ke nama finger yang persis sama
        let k = listKaryawan.find(item => item.finger && item.finger.trim().toUpperCase() === fUpper);

        if (k) {
            let logsPerTgl = rawFingerLogs[fName];
            Object.keys(logsPerTgl).forEach(dayNum => {
                let d = logsPerTgl[dayNum];
                if (!dataAbsensi[k.id][dayNum]) {
                    dataAbsensi[k.id][dayNum] = { in: "", out: "", status: "" };
                }
                dataAbsensi[k.id][dayNum].in = d.in;
                dataAbsensi[k.id][dayNum].out = d.out;
            });
        }
    });

    // 3. Render tabel & sinkronkan hasil kalkulasi
    renderAbsensiTable();
}

// IMPORT LOG MESIN & MENAMPILKAN NAMA BERKAS
function importLogFinger(input) {
    let file = input.files[0];
    if(!file) return;

    if(importedFilesList.includes(file.name)) {
        return alert(`File "${file.name}" sudah pernah di-import!`);
    }

    let reader = new FileReader();
    reader.onload = function(e) {
        let bytes = new Uint8Array(e.target.result);
        let wb = XLSX.read(bytes, {type:'array'});
        let ws = wb.Sheets['Lap. Log Absen'] || wb.Sheets[wb.SheetNames[0]];
        let json = XLSX.utils.sheet_to_json(ws, {header:1});

        // BACA PERIODE
        if (json[2] && json[2][2]) {
            periodeText = String(json[2][2]).trim();
            let match = periodeText.match(/(\d{4})-(\d{2})-(\d{2})/);
            if(match) {
                tglStartYear = parseInt(match[1]);
                tglStartMonth = parseInt(match[2]) - 1;
            }
        }

        dataAbsensiPerFile[file.name] = {};

        for(let r=4; r<json.length; r+=2) {
            let fingerName = json[r] ? json[r][10] : null;
            if(fingerName) {
                let fUpper = String(fingerName).trim().toUpperCase();
                let logRow = json[r+1];
                if(logRow) {
                    for(let c=0; c<logRow.length; c++) {
                        let tglHead = json[3] ? json[3][c] : null;
                        let rawTime = logRow[c];
                        if(tglHead && rawTime) {
                            let dayNum = parseInt(tglHead);
                            let timeStr = String(rawTime).trim();
                            let times = timeStr.match(/\d{2}:\d{2}/g);
                            let inStr = "", outStr = "";

                            if (times && times.length > 0) {
                                if (times.length === 1) {
                                    let h = parseInt(times[0].substring(0, 2));
                                    if (h < 13) inStr = times[0];
                                    else outStr = times[0];
                                } else {
                                    let firstTime = times[0];
                                    let lastTime = times[times.length - 1];
                                    let [fH, fM] = firstTime.split(':').map(Number);
                                    let [lH, lM] = lastTime.split(':').map(Number);
                                    let firstMins = fH * 60 + fM;
                                    let lastMins = lH * 60 + lM;

                                    if (fH < 13) {
                                        inStr = firstTime;
                                        if (lastMins - firstMins >= 60 || lH >= 12) {
                                            outStr = lastTime;
                                        }
                                    } else {
                                        outStr = lastTime;
                                    }
                                }
                            }

                            // Simpan ke RAW LOGS berdasarkan NAMA FINGER MESIN
                            if(!rawFingerLogs[fUpper]) rawFingerLogs[fUpper] = {};
                            rawFingerLogs[fUpper][dayNum] = { in: inStr, out: outStr, sourceFile: file.name };

                            if(!dataAbsensiPerFile[file.name][fUpper]) dataAbsensiPerFile[file.name][fUpper] = {};
                            dataAbsensiPerFile[file.name][fUpper][dayNum] = true;
                        }
                    }
                }
            }
        }

        importedFilesList.push(file.name);
        updateImportDropdownUI();
        remapAbsensiDariRawLogs(); // Hubungkan langsung ke daftar karyawan saat ini
        saveToLocalStorage();
        alert(`✨ File "${file.name}" berhasil di-import ya Sayanggg😘!`);
    };
    reader.readAsArrayBuffer(file);
}

// FUNGSI UPDATE UI DROPDOWN HAPUS FILE
function updateImportDropdownUI() {
    let container = document.getElementById('dropdownHapusContainer');
    let menuList = document.getElementById('listImportedFiles');

    if (importedFilesList.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'inline-block';
    menuList.innerHTML = '';

    // Render daftar file satu per satu
    importedFilesList.forEach(fileName => {
        let item = document.createElement('a');
        item.href = '#';
        item.innerHTML = `<i class="fa-solid fa-file-excel"></i> Hapus ${fileName}`;
        item.onclick = function(e) {
            e.preventDefault();
            deleteSpecificFile(fileName);
        };
        menuList.appendChild(item);
    });

    // Tambahkan Opsi Hapus Semua
    let deleteAll = document.createElement('a');
    deleteAll.href = '#';
    deleteAll.style.color = '#e74c3c';
    deleteAll.style.fontWeight = 'bold';
    deleteAll.style.borderTop = '1px solid #ffd8e1';
    deleteAll.innerHTML = `<i class="fa-solid fa-trash-can"></i> Hapus Semua File`;
    deleteAll.onclick = function(e) {
        e.preventDefault();
        clearImportedData();
    };
    menuList.appendChild(deleteAll);
}

// HAPUS FILE TERTENTU
// HAPUS FILE TERTENTU BESERTA RAW LOG-NYA
function deleteSpecificFile(fileName) {
    if(confirm(`Yakin Aci ingin menghapus data dari file "${fileName}"?`)) {
        // 1. Bersihkan rawFingerLogs yang berasal dari file ini
        if (typeof rawFingerLogs !== 'undefined') {
            Object.keys(rawFingerLogs).forEach(fName => {
                Object.keys(rawFingerLogs[fName]).forEach(dayNum => {
                    if (rawFingerLogs[fName][dayNum].sourceFile === fileName) {
                        delete rawFingerLogs[fName][dayNum];
                    }
                });
                // Hapus key nama jika sudah tidak punya tanggal log lagi
                if (Object.keys(rawFingerLogs[fName]).length === 0) {
                    delete rawFingerLogs[fName];
                }
            });
        }

        // 2. Bersihkan jejak file
        delete dataAbsensiPerFile[fileName];
        importedFilesList = importedFilesList.filter(f => f !== fileName);

        // 3. Jika semua file sudah terhapus, reset teks periode
        if (importedFilesList.length === 0) {
            periodeText = "";
            let badge = document.getElementById('badgePeriode');
            if (badge) badge.style.display = 'none';
        }

        // 4. Petakan ulang tabel absensi agar jam dari file yang dihapus langsung bersih
        if (typeof remapAbsensiDariRawLogs === 'function') {
            remapAbsensiDariRawLogs();
        }

        // 5. Update tampilan dan simpan ke Firebase/LocalStorage
        updateImportDropdownUI();
        saveToLocalStorage();
        alert(`File "${fileName}" telah berhasil Uby dihapus.`);
    }
}

// HAPUS SEMUA DATA IMPORT (RESET TOTAL)
function clearImportedData() {
    if(confirm("Apakah Aci yakin ingin menghapus Seluruh data import?")) {
        dataAbsensi = {};
        dataAbsensiPerFile = {};
        rawFingerLogs = {};
        importedFilesList = [];
        initDataAbsensi();
        updateImportDropdownUI();
        document.getElementById('inputLogFile').value = "";
        renderAbsensiTable();
        saveToLocalStorage();
        alert("Semua data import telah dibersihkan ya Sayang😘.");
    }
}


// EXPORT TO EXCEL DENGAN BORDER ISI LENGKAP & HEADER DI TENGAH
function exportKeExcel(deptChoice) {
    let wb = XLSX.utils.book_new();
    let targetKaryawan = listKaryawan.filter(k => deptChoice === 'ALL' || k.dept === deptChoice);

    if(targetKaryawan.length === 0) {
        return alert("Tidak ada data karyawan untuk departemen yang dipilih!");
    }

    let deptTitle = deptChoice === 'ALL' ? 'SEMUA DEPARTEMEN' : deptChoice;
    let rowPeriode = ["Periode: 15 Bulan Ini - 14 Bulan Depan"];
    let rowDept = [`Department Name : ${deptTitle}`];

    let headerRow1 = ["No", "NAMA", "JABATAN", "GAPOK (70%)", "TUNJ. (30%)", "GAJI BRUTO", "JAM MASUK"];
    let headerRow2 = ["", "", "", "", "", "", ""];

    let merges = [];

    // 1. Merge Header Identitas Kebawah (Vertikal)
    for (let colIdx = 0; colIdx < 7; colIdx++) {
        merges.push({
            s: { r: 2, c: colIdx },
            e: { r: 3, c: colIdx }
        });
    }

    // 2. Build Header Tanggal (Merge Horizontal 3 Kolom)
    listTanggal.forEach((tgl, idxTgl) => {
        headerRow1.push(`Tgl ${tgl}`, "", "");
        headerRow2.push("IN", "OUT", "TELAT");

        let colStart = 7 + (idxTgl * 3);
        merges.push({
            s: { r: 2, c: colStart },
            e: { r: 2, c: colStart + 2 }
        });
    });

    let wsData = [rowPeriode, rowDept, headerRow1, headerRow2];

    // 3. Tambahkan Baris Isi Konten
    targetKaryawan.forEach((k, idxRow) => {
        let bruto = (k.gapok || 0) + (k.tunj || 0);
        let row = [idxRow + 1, k.nama, k.jabatan, k.gapok || 0, k.tunj || 0, bruto, k.jamIn];
        let currentRowIndex = wsData.length;

        listTanggal.forEach((tgl, idxTgl) => {
            let d = (dataAbsensi[k.id] && dataAbsensi[k.id][tgl]) ? dataAbsensi[k.id][tgl] : {in:"", out:"", status:""};
            let colStart = 7 + (idxTgl * 3);

            if(d.status) {
                row.push(d.status, "", "");
                merges.push({
                    s: { r: currentRowIndex, c: colStart },
                    e: { r: currentRowIndex, c: colStart + 2 }
                });
            } else {
                row.push(d.in || "", d.out || "", hitungTelat(d.in, k.jamIn));
            }
        });

        wsData.push(row);
    });

    let ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = merges;

    // 4. PEMBUATAN GARIS / BORDER LENGKAP & ALIGNMENT DI TENGAH
    let range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 2; R <= range.e.r; ++R) {
        for (let C = 0; C <= range.e.c; ++C) {
            let cell_ref = XLSX.utils.encode_cell({ c: C, r: R });

            if (!ws[cell_ref]) ws[cell_ref] = { t: 's', v: '' };
            if (!ws[cell_ref].s) ws[cell_ref].s = {};

            // Penerapan Garis Pinggir (Border)
            ws[cell_ref].s.border = {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            };

            // Alignment Teks Rata Tengah (Center Alignment)
            ws[cell_ref].s.alignment = {
                vertical: "center",
                horizontal: (R > 3 && (C === 1 || C === 2)) ? "left" : "center", // Nama/Jabatan Rata Kiri, Header/Lainnya Rata Tengah
                wrapText: true
            };
        }
    }

    let sheetName = deptChoice === 'ALL' ? "Absensi All" : (deptChoice.includes("PRODUKSI") ? "Absensi Produksi" : "Absensi Lt 3");
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `Rekap_Absensi_${sheetName.replace(/ /g, "_")}.xlsx`);
}

// HELPER: BUILD TEMPLATE HTML FORM MODAL
function getFormKaryawanHtml(k = {}) {
    const listDept = [
        "HEAD OFFICE LANTAI 3",
        "PRODUKSI"
    ];

    const deptOptions = listDept.map(d => 
        `<option value="${d}" ${k.dept === d ? 'selected' : ''}>${d}</option>`
    ).join('');

    return `
        <div style="text-align: left; font-size: 13px; color: #4a3f44; display: flex; flex-direction: column; gap: 10px;">
            <div>
                <label style="font-weight: 600; font-size: 11px;">NAMA LENGKAP</label>
                <input id="swalNama" class="swal2-input" style="margin: 4px 0 0 0; width: 100%; height: 36px; font-size: 13px; border-radius: 8px;" value="${k.nama || ''}" placeholder="Nama Lengkap">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    <label style="font-weight: 600; font-size: 11px;">JABATAN</label>
                    <input id="swalJabatan" class="swal2-input" style="margin: 4px 0 0 0; width: 100%; height: 36px; font-size: 13px; border-radius: 8px;" value="${k.jabatan || ''}" placeholder="Jabatan">
                </div>
                <div>
                    <label style="font-weight: 600; font-size: 11px;">NAMA MESIN FINGER</label>
                    <input id="swalFinger" class="swal2-input" style="margin: 4px 0 0 0; width: 100%; height: 36px; font-size: 13px; border-radius: 8px;" value="${k.finger || ''}" placeholder="Nama di Mesin">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    <label style="font-weight: 600; font-size: 11px;">DEPARTEMEN</label>
                    <select id="swalDept" class="swal2-select" style="margin: 4px 0 0 0; width: 100%; height: 36px; font-size: 12px; border-radius: 8px;">
                        ${deptOptions}
                    </select>
                </div>
                <div>
                    <label style="font-weight: 600; font-size: 11px;">JAM MASUK (HH:MM)</label>
                    <input id="swalJamIn" class="swal2-input" style="margin: 4px 0 0 0; width: 100%; height: 36px; font-size: 13px; border-radius: 8px;" value="${k.jamIn || '09:00'}" placeholder="09:00">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    <label style="font-weight: 600; font-size: 11px;">GAJI POKOK (Rp)</label>
                    <input id="swalGapok" type="number" class="swal2-input" style="margin: 4px 0 0 0; width: 100%; height: 36px; font-size: 13px; border-radius: 8px;" value="${k.gapok || 0}" placeholder="0">
                </div>
                <div>
                    <label style="font-weight: 600; font-size: 11px;">TUNJANGAN (Rp)</label>
                    <input id="swalTunj" type="number" class="swal2-input" style="margin: 4px 0 0 0; width: 100%; height: 36px; font-size: 13px; border-radius: 8px;" value="${k.tunj || 0}" placeholder="0">
                </div>
            </div>
        </div>
    `;
}

// POP-UP TAMBAH KARYAWAN
function openAddModal() {
    Swal.fire({
        title: '<i class="fa-solid fa-user-plus" style="color:#f78fb3;"></i> Tambah Karyawan Nihh',
        html: getFormKaryawanHtml({ dept: "HEAD OFFICE LANTAI 3", jamIn: "09:00", gapok: 0, tunj: 0 }),
        showCancelButton: true,
        confirmButtonText: 'Simpan Data',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#f78fb3',
        cancelButtonColor: '#b2bec3',
        focusConfirm: false,
        preConfirm: () => {
            const nama = document.getElementById('swalNama').value.trim();
            const finger = document.getElementById('swalFinger').value.trim();
            if (!nama) {
                Swal.showValidationMessage('Nama lengkap wajib diisi!');
                return false;
            }
            if (!finger) {
                Swal.showValidationMessage('Nama Finger wajib diisi!');
                return false;
            }
            return {
                id: listKaryawan.length ? Math.max(...listKaryawan.map(k => k.id)) + 1 : 1,
                nama: nama,
                jabatan: document.getElementById('swalJabatan').value.trim(),
                finger: document.getElementById('swalFinger').value.trim(),
                dept: document.getElementById('swalDept').value,
                jamIn: document.getElementById('swalJamIn').value.trim() || "09:00",
                gapok: parseInt(document.getElementById('swalGapok').value) || 0,
                tunj: parseInt(document.getElementById('swalTunj').value) || 0
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            listKaryawan.push(result.value);
            initDataAbsensi();
            if (typeof remapAbsensiDariRawLogs === 'function') remapAbsensiDariRawLogs();
            renderKaryawanTable();
            saveToLocalStorage();
            Swal.fire({
                icon: 'success',
                title: 'Tersimpan!',
                text: 'Karyawan baru berhasil ditambahkan. Jangan lupa cerita ke Uby Ok !',
                timer: 3100,
                showConfirmButton: false
            });
        }
    });
}

// POP-UP EDIT KARYAWAN
function openEditModal(id) {
    let k = listKaryawan.find(item => item.id === id);
    if (!k) return;

    Swal.fire({
        title: '<i class="fa-solid fa-user-pen" style="color:#f78fb3;"></i> Edit Data Karyawan',
        html: getFormKaryawanHtml(k),
        showCancelButton: true,
        confirmButtonText: 'Update Data',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#f78fb3',
        cancelButtonColor: '#b2bec3',
        focusConfirm: false,
        preConfirm: () => {
            const nama = document.getElementById('swalNama').value.trim();
            const finger = document.getElementById('swalFinger').value.trim();
            if (!nama) {
                Swal.showValidationMessage('Nama lengkap wajib diisi!');
                return false;
            }
            if (!finger) {
                Swal.showValidationMessage('Nama Finger wajib diisi!');
                return false;
            }
            return {
                nama: nama,
                jabatan: document.getElementById('swalJabatan').value.trim(),
                finger: document.getElementById('swalFinger').value.trim(),
                dept: document.getElementById('swalDept').value,
                jamIn: document.getElementById('swalJamIn').value.trim() || "09:00",
                gapok: parseInt(document.getElementById('swalGapok').value) || 0,
                tunj: parseInt(document.getElementById('swalTunj').value) || 0
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Object.assign(k, result.value);
            initDataAbsensi();
            if (typeof remapAbsensiDariRawLogs === 'function') remapAbsensiDariRawLogs();
            renderKaryawanTable();
            saveToLocalStorage();
            Swal.fire({
                icon: 'success',
                title: 'Ok Uby Update yaa!',
                text: 'Perubahan data karyawan berhasil Uby disimpan.',
                timer: 2500,
                showConfirmButton: false
            });
        }
    });
}

function closeModal() {
    document.getElementById('modalKaryawan').style.display = 'none';
}

function saveKaryawan() {
    let editId = document.getElementById('mEditId').value;
    let nama = document.getElementById('mNama').value;
    let jabatan = document.getElementById('mJabatan').value;
    let finger = document.getElementById('mNamaFinger').value;
    let dept = document.getElementById('mDept').value;
    let jamIn = document.getElementById('mJamMasuk').value;
    let gapok = parseInt(document.getElementById('mGapok').value);
    let tunj = parseInt(document.getElementById('mTunj').value);

    if(!nama) return alert("Nama wajib diisi!");
    if(!finger) return alert("Nama Finger wajib diisi!");

    if(editId) {
        let k = listKaryawan.find(item => item.id === parseInt(editId));
        if(k) {
            k.nama = nama;
            k.jabatan = jabatan;
            k.finger = finger;
            k.dept = dept;
            k.jamIn = jamIn;
            k.gapok = gapok;
            k.tunj = tunj;
        }
    } else {
        let newId = listKaryawan.length ? Math.max(...listKaryawan.map(k => k.id)) + 1 : 1;
        listKaryawan.push({ id: newId, nama, jabatan, finger, dept, jamIn, gapok, tunj });
    }

    initDataAbsensi();
    remapAbsensiDariRawLogs();
    saveToLocalStorage(); // <-- Menambahkan ini agar perubahan nama/data langsung masuk ke Firebase
    renderKaryawanTable();
    closeModal();
}

// POP-UP HAPUS KARYAWAN DENGAN SWEETALERT2
function deleteKaryawan(id) {
    let k = listKaryawan.find(item => item.id === id);
    let namaKaryawan = k ? k.nama : "Karyawan ini";

    Swal.fire({
        title: 'Kok Dihapus ?',
        html: `Apakah Aci yakin ingin menghapus <b>${namaKaryawan}</b> dari sistem?`,
        icon: 'warning',
        iconColor: '#ff7675',
        showCancelButton: true,
        confirmButtonColor: '#d63031',
        cancelButtonColor: '#b2bec3',
        confirmButtonText: '<i class="fa-solid fa-trash"></i> Ya, Hapus!',
        cancelButtonText: 'Kepencet',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            listKaryawan = listKaryawan.filter(k => k.id !== id);
            
            if (typeof remapAbsensiDariRawLogs === 'function') {
                remapAbsensiDariRawLogs();
            }
            
            renderKaryawanTable();
            saveToLocalStorage();

            Swal.fire({
                icon: 'success',
                title: 'Ok Uby Hapus!',
                text: `${namaKaryawan} telah berhasil Uby dihapus. Jangan nyesel ya..`,
                timer: 1500,
                showConfirmButton: false
            });
        }
    });
}

// SIMPAN KE FIREBASE & CADANGAN LOKAL
async function saveToLocalStorage() {
    // 1. Simpan ke browser untuk cache instan
    localStorage.setItem('ACI_LIST_KARYAWAN', JSON.stringify(listKaryawan));
    localStorage.setItem('ACI_DATA_ABSENSI', JSON.stringify(dataAbsensi));
    localStorage.setItem('ACI_IMPORTED_FILES', JSON.stringify(importedFilesList));
    localStorage.setItem('ACI_DATA_PER_FILE', JSON.stringify(dataAbsensiPerFile));
    localStorage.setItem('ACI_PERIODE_TEXT', periodeText);
    localStorage.setItem('ACI_RAW_FINGER_LOGS', JSON.stringify(rawFingerLogs));

    // 2. Simpan permanen ke Cloud Firestore
    if (db) {
        try {
            await db.collection("absensi_app").doc("state_utama").set({
                listKaryawan: listKaryawan,
                dataAbsensi: dataAbsensi,
                importedFilesList: importedFilesList,
                dataAbsensiPerFile: dataAbsensiPerFile,
                periodeText: periodeText,
                rawFingerLogs: rawFingerLogs,
                updatedAt: new Date().toISOString()
            });
            console.log("☁️ Data berhasil disinkronkan ke Firebase!");
        } catch (e) {
            console.error("Gagal sinkron ke Firebase:", e);
        }
    }
}

// MUAT DATA DARI FIREBASE SAAT BUKA WEB
async function loadFromLocalStorage() {
    let loadedFromCloud = false;

    if (db) {
        try {
            const doc = await db.collection("absensi_app").doc("state_utama").get();
            if (doc.exists) {
                const data = doc.data();

                if (data.listKaryawan && Array.isArray(data.listKaryawan) && data.listKaryawan.length > 0) {
                    listKaryawan = data.listKaryawan;
                }
                if (data.dataAbsensi && Object.keys(data.dataAbsensi).length > 0) {
                    dataAbsensi = data.dataAbsensi;
                }
                if (data.importedFilesList) importedFilesList = data.importedFilesList;
                if (data.dataAbsensiPerFile) dataAbsensiPerFile = data.dataAbsensiPerFile;
                if (data.periodeText) periodeText = data.periodeText;
                if (data.rawFingerLogs) rawFingerLogs = data.rawFingerLogs;

                loadedFromCloud = true;
                console.log("☁️ Data berhasil dimuat dari Firebase!");
            }
        } catch (e) {
            console.warn("Gagal memuat dari Cloud Firestore, menggunakan data lokal:", e);
        }
    }

    // Fallback jika Firebase belum ada data atau gagal termuat
    if (!loadedFromCloud) {
        let savedKaryawan = localStorage.getItem('ACI_LIST_KARYAWAN');
        let savedAbsensi = localStorage.getItem('ACI_DATA_ABSENSI');
        let savedFiles = localStorage.getItem('ACI_IMPORTED_FILES');
        let savedPerFile = localStorage.getItem('ACI_DATA_PER_FILE');
        let savedPeriode = localStorage.getItem('ACI_PERIODE_TEXT');
        let savedRawLogs = localStorage.getItem('ACI_RAW_FINGER_LOGS');

        if (savedKaryawan) listKaryawan = JSON.parse(savedKaryawan);
        if (savedAbsensi) dataAbsensi = JSON.parse(savedAbsensi);
        if (savedFiles) importedFilesList = JSON.parse(savedFiles);
        if (savedPerFile) dataAbsensiPerFile = JSON.parse(savedPerFile);
        if (savedPeriode) periodeText = savedPeriode;
        if (savedRawLogs) rawFingerLogs = JSON.parse(savedRawLogs);
    }

    initDataAbsensi();
    updateImportDropdownUI();
    remapAbsensiDariRawLogs();
    renderKaryawanTable();
    renderAbsensiTable();

    // =========================================================================
    // SWEETALERT2 MODERN: PENGINGAT FILE IMPORT LAMA
    // =========================================================================
    if (importedFilesList && importedFilesList.length > 0) {
        setTimeout(() => {
            const listHtml = importedFilesList
                .map(f => `<li style="margin-bottom:4px;"><i class="fa-solid fa-file-excel" style="color:#27ae60;"></i> <b>${f}</b></li>`)
                .join("");

            Swal.fire({
                title: 'Perhatian Sayang😮',
                html: `
                    <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #4a3f44;">
                        <p style="margin-bottom: 8px;">Uby menemukan riwayat file absensi Aci yang masih tersimpan:</p>
                        <ul style="background: #fff0f5; padding: 10px 25px; border-radius: 8px; border: 1px solid #ffd8e1; list-style: none;">
                            ${listHtml}
                        </ul>
                        <p style="margin-top: 10px; color: #d63031; font-weight: 500;">
                            <i class="fa-solid fa-triangle-exclamation"></i> Uby sarankan untuk mereset/menghapus file lama sebelum memasukkan file baru agar tidak terjadi bentrok atau duplikasi <br> data😘
                        </p>
                    </div>
                `,
                icon: 'warning',
                iconColor: '#f78fb3',
                showCancelButton: true,
                confirmButtonColor: '#e74c3c',
                cancelButtonColor: '#f8a5c2',
                confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Iya Aci Hapus😒',
                cancelButtonText: 'Masih Aci Pakai',
                reverseButtons: true,
                background: '#ffffff',
                customClass: {
                    popup: 'swal2-pink-border'
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    // 1. Reset data di memory
                    dataAbsensi = {};
                    dataAbsensiPerFile = {};
                    importedFilesList = [];
                    periodeText = "";
                    if (typeof rawFingerLogs !== 'undefined') rawFingerLogs = {};

                    // 2. Langsung paksa sembunyikan badge merah periode dari layar
                    const badge = document.getElementById('badgePeriode');
                    const txt = document.getElementById('textPeriode');
                    if (badge) badge.style.display = 'none';
                    if (txt) txt.innerText = '-';

                    // 3. Reset input file dan inisialisasi ulang
                    const inputFile = document.getElementById('inputLogFile');
                    if (inputFile) inputFile.value = '';

                    initDataAbsensi();
                    updateImportDropdownUI();
                    renderAbsensiTable();
                    saveToLocalStorage();

                    Swal.fire({
                        title: 'Data Berhasil  Uby Bersihkan!',
                        text: 'File import lama uby telah dihapus. Sistem siap menerima file baru dari Aci🤗.',
                        icon: 'success',
                        confirmButtonColor: '#f78fb3',
                        timer: 2800,
                        showConfirmButton: false
                    });
                }
            });
        }, 750);
    }
}

// ===============================================
// EFEK HUJAN MULTI-FOTO (BESAR & TRANSPARAN)
// ===============================================
const canvas = document.getElementById('canvasHujan');
const ctx = canvas.getContext('2d');

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
});

// 1. DAFTAR PATH FOTO PNG
const pathFotoList = [
    'img/foto1.png',
    'img/Aci2.png',
    'img/foto2.png',
    'img/Aci1.png'

];

const loadedImages = pathFotoList.map(src => {
    const img = new Image();
    img.src = src;
    return img;
});

const totalFoto = 10; 
const listPartikel = [];

// 2. INISIALISASI PARTIKEL (DENGAN PROPERTI OPACITY TEGAS)
for (let i = 0; i < totalFoto; i++) {
    listPartikel.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        size: Math.random() * 30 + 60,          // Ukuran foto besar (60px - 90px)
        speedY: Math.random() * 0.8 + 0.4,    // Kecepatan jatuh lambat
        speedX: Math.random() * 0.4 - 0.2,    // Goyangan kiri/kanan
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: Math.random() * 0.02 - 0.01,
        opacity: 0.48,   // Nilai transparansi acak (0.3 s.d 0.5)
        imgObj: loadedImages[Math.floor(Math.random() * loadedImages.length)]
    });
}

// 3. LOOP ANIMASI DENGAN APPLIED GLOBAL ALPHA
function animateHujan() {
    ctx.clearRect(0, 0, width, height);

    listPartikel.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotSpeed;

        if (p.y > height + 100) {
            p.y = -100;
            p.x = Math.random() * width;
        }

        ctx.save();
        
        // Menerapkan Transparansi / Opacity Secara Maksimal
        ctx.globalAlpha = p.opacity; 
        
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        
        if (p.imgObj && p.imgObj.complete && p.imgObj.naturalWidth !== 0) {
            ctx.drawImage(p.imgObj, -p.size / 2, -p.size / 2, p.size, p.size);
        }
        
        ctx.restore();
    });

    requestAnimationFrame(animateHujan);
}

// FUNGSI TOGGLE HIDE / SHOW SIDEBAR
function toggleSidebar() {
    document.body.classList.toggle('sidebar-collapsed');
    
    // Simpan status pilihan pengguna ke LocalStorage agar tetap bertahan saat refresh
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    localStorage.setItem('ACI_SIDEBAR_COLLAPSED', isCollapsed);
}

// Cek status sidebar saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    const isCollapsed = localStorage.getItem('ACI_SIDEBAR_COLLAPSED') === 'true';
    if (isCollapsed) {
        document.body.classList.add('sidebar-collapsed');
    }
});

// FUNGSI TOGGLE KLIK DROPDOWN HAPUS IMPORT
function toggleHapusDropdown(event) {
    event.stopPropagation();
    let container = document.getElementById('dropdownHapusContainer');
    if (container) {
        container.classList.toggle('active');
    }
}

// TUTUP DROPDOWN SAAT KLIK DI LUAR
window.addEventListener('click', function(e) {
    let container = document.getElementById('dropdownHapusContainer');
    if (container && !container.contains(e.target)) {
        container.classList.remove('active');
    }
});


// Jalankan Animasi
animateHujan();
// Jalankan Animasi & Muat Data
initDataAbsensi();
loadFromLocalStorage(); // Fungsi ini akan otomatis me-render tabel setelah data dari Firebase selesai diambil

