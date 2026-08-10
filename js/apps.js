// Store Absensi Data: { empId: { tgl: { in: "", out: "", status: "" } } }
let dataAbsensi = {};
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

    if(viewName === 'karyawan') {
        document.querySelectorAll('.nav-item')[0].classList.add('active');
        document.getElementById('viewKaryawan').classList.add('active');
        document.getElementById('pageTitle').innerText = "Data Karyawan";
        document.getElementById('headerActions').style.display = "block";
    } else if(viewName === 'absensi') {
        document.querySelectorAll('.nav-item')[1].classList.add('active');
        document.getElementById('viewAbsensi').classList.add('active');
        document.getElementById('pageTitle').innerText = "Absensi Karyawan";
        document.getElementById('headerActions').style.display = "none";
        renderAbsensiTable();
    } else if(viewName === 'laporan') {
        document.querySelectorAll('.nav-item')[2].classList.add('active');
        document.getElementById('viewLaporan').classList.add('active');
        document.getElementById('pageTitle').innerText = "Rekap & Laporan";
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

function deleteKaryawan(id) {
    if(confirm("Yakin mau hapus karyawan ini?")) {
        listKaryawan = listKaryawan.filter(k => k.id !== id);
        renderKaryawanTable();
    }
}

function renderAbsensiTable() {
    // Tampilkan Periode jika ada
    let badge = document.getElementById('badgePeriode');
    let txt = document.getElementById('textPeriode');
    if (periodeText && badge && txt) {
        txt.innerText = periodeText;
        badge.style.display = 'inline-flex';
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

        // ===============================================
        // BACA PERIODE DARI CELL C3 (Baris Indeks 2, Kolom Indeks 2)
        // ===============================================
        if (json[2] && json[2][2]) {
            periodeText = String(json[2][2]).trim();
            
            // Ekstrak Tahun & Bulan dari format "2026-07-15 ~ 2026-08-04"
            let match = periodeText.match(/(\d{4})-(\d{2})-(\d{2})/);
            if(match) {
                tglStartYear = parseInt(match[1]);
                tglStartMonth = parseInt(match[2]) - 1; // Konversi bulan ke format 0-indexed JS (Januari=0, Juli=6)
            }
        }

        dataAbsensiPerFile[file.name] = {};

        for(let r=4; r<json.length; r+=2) {
            let fingerName = json[r] ? json[r][10] : null;
            if(fingerName) {
                let fUpper = String(fingerName).trim().toUpperCase();
                let k = listKaryawan.find(item => item.finger.toUpperCase() === fUpper || item.nama.toUpperCase().includes(fUpper));
                
                if(k) {
                    let logRow = json[r+1];
                    if(logRow) {
                        for(let c=0; c<logRow.length; c++) {
                            let tglHead = json[3] ? json[3][c] : null;
                            let rawTime = logRow[c];
                            if(tglHead && rawTime) {
                                let dayNum = parseInt(tglHead);
                                let timeStr = String(rawTime).trim();
                                
                                // AMBIL SEMUA FORMAT JAM (HH:MM) YANG TERTULIS DENGAN REGEX
                                let times = timeStr.match(/\d{2}:\d{2}/g);
                                let inStr = "", outStr = "";

                                if (times && times.length > 0) {
                                    if (times.length === 1) {
                                        // Jika hanya ada 1 record jam
                                        let h = parseInt(times[0].substring(0, 2));
                                        if (h < 13) inStr = times[0];
                                        else outStr = times[0];
                                    } else {
                                        // Jika ada 2 record jam atau lebih (akibat double/multiple scan)
                                        let firstTime = times[0];                   // Jam pendaftaran paling awal
                                        let lastTime = times[times.length - 1];     // Jam pendaftaran paling akhir

                                        let [fH, fM] = firstTime.split(':').map(Number);
                                        let [lH, lM] = lastTime.split(':').map(Number);
                                        let firstMins = fH * 60 + fM;
                                        let lastMins = lH * 60 + lM;

                                        if (fH < 13) {
                                            inStr = firstTime; // Jam paling awal diambil sebagai jam IN
                                            
                                            // Jam OUT hanya diambil jika jam scan terakhir berjarak minimal 1 jam (60 menit)
                                            // atau dilakukan pada sore/pulang kerja (>= 12:00)
                                            if (lastMins - firstMins >= 60 || lH >= 12) {
                                                outStr = lastTime;
                                            }
                                        } else {
                                            // Jika semua scan terjadi di atas jam 13:00
                                            outStr = lastTime;
                                        }
                                    }
                                }

                                // Simpan ke data utama
                                if(!dataAbsensi[k.id]) dataAbsensi[k.id] = {};
                                dataAbsensi[k.id][dayNum] = { in: inStr, out: outStr, status:"" };

                                // Simpan rekam Jejak khusus per file
                                if(!dataAbsensiPerFile[file.name][k.id]) dataAbsensiPerFile[file.name][k.id] = {};
                                dataAbsensiPerFile[file.name][k.id][dayNum] = true;
                            }
                        }
                    }
                }
            }
        }

        importedFilesList.push(file.name);
        updateImportDropdownUI();
        saveToLocalStorage();
        alert(`✨ File "${file.name}" berhasil di-import!`);
        renderAbsensiTable();
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
function deleteSpecificFile(fileName) {
    if(confirm(`Yakin ingin menghapus data dari file "${fileName}"?`)) {
        let fileLogs = dataAbsensiPerFile[fileName];
        if(fileLogs) {
            Object.keys(fileLogs).forEach(empId => {
                Object.keys(fileLogs[empId]).forEach(tgl => {
                    if(dataAbsensi[empId] && dataAbsensi[empId][tgl]) {
                        dataAbsensi[empId][tgl].in = "";
                        dataAbsensi[empId][tgl].out = "";
                    }
                });
            });
        }
        
        delete dataAbsensiPerFile[fileName];
        importedFilesList = importedFilesList.filter(f => f !== fileName);
        updateImportDropdownUI();
        renderAbsensiTable();
        saveToLocalStorage();
        alert(`File "${fileName}" telah dihapus.`);
    }
}

// HAPUS SEMUA DATA IMPORT (RESET TOTAL)
function clearImportedData() {
    if(confirm("Apakah Anda yakin ingin menghapus SELURUH data import?")) {
        dataAbsensi = {};
        dataAbsensiPerFile = {};
        importedFilesList = [];
        initDataAbsensi();
        updateImportDropdownUI();
        document.getElementById('inputLogFile').value = "";
        renderAbsensiTable();
        saveToLocalStorage();
        alert("Semua data import telah dibersihkan.");
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

function openAddModal() {
    document.getElementById('modalTitle').innerText = "Tambah Karyawan";
    document.getElementById('mEditId').value = "";
    document.getElementById('mNama').value = "";
    document.getElementById('mJabatan').value = "";
    document.getElementById('mNamaFinger').value = "";
    document.getElementById('mDept').value = "HEAD OFFICE LANTAI 3";
    document.getElementById('mJamMasuk').value = "09:00";
    document.getElementById('mGapok').value = 0;
    document.getElementById('mTunj').value = 0;
    document.getElementById('modalKaryawan').style.display = 'flex';
}

function openEditModal(id) {
    let k = listKaryawan.find(item => item.id === id);
    if(!k) return;

    document.getElementById('modalTitle').innerText = "Edit Data Karyawan";
    document.getElementById('mEditId').value = k.id;
    document.getElementById('mNama').value = k.nama;
    document.getElementById('mJabatan').value = k.jabatan;
    document.getElementById('mNamaFinger').value = k.finger;
    document.getElementById('mDept').value = k.dept;
    document.getElementById('mJamMasuk').value = k.jamIn;
    document.getElementById('mGapok').value = k.gapok || 0;
    document.getElementById('mTunj').value = k.tunj || 0;
    document.getElementById('modalKaryawan').style.display = 'flex';
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
    let gapok = parseInt(document.getElementById('mGapok').value) || 0;
    let tunj = parseInt(document.getElementById('mTunj').value) || 0;

    if(!nama) return alert("Nama wajib diisi!");

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
    renderKaryawanTable();
    closeModal();
}


// SIMPAN DATA KE BROWSER
function saveToLocalStorage() {
    localStorage.setItem('ACI_LIST_KARYAWAN', JSON.stringify(listKaryawan)); // <-- Menyimpan urutan array
    localStorage.setItem('ACI_DATA_ABSENSI', JSON.stringify(dataAbsensi));
    localStorage.setItem('ACI_IMPORTED_FILES', JSON.stringify(importedFilesList));
    localStorage.setItem('ACI_DATA_PER_FILE', JSON.stringify(dataAbsensiPerFile));
    localStorage.setItem('ACI_PERIODE_TEXT', periodeText);
}

function loadFromLocalStorage() {
    let savedKaryawan = localStorage.getItem('ACI_LIST_KARYAWAN'); // <-- Memuat urutan array
    let savedAbsensi = localStorage.getItem('ACI_DATA_ABSENSI');
    let savedFiles = localStorage.getItem('ACI_IMPORTED_FILES');
    let savedPerFile = localStorage.getItem('ACI_DATA_PER_FILE');
    let savedPeriode = localStorage.getItem('ACI_PERIODE_TEXT');

    if (savedKaryawan) listKaryawan = JSON.parse(savedKaryawan);
    if (savedAbsensi) dataAbsensi = JSON.parse(savedAbsensi);
    if (savedFiles) importedFilesList = JSON.parse(savedFiles);
    if (savedPerFile) dataAbsensiPerFile = JSON.parse(savedPerFile);
    if (savedPeriode) periodeText = savedPeriode;
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
// INIT PROGRAM
initDataAbsensi();         // Siapkan struktur awal data
loadFromLocalStorage();   // Muat data lama dari browser jika ada
updateImportDropdownUI(); // Update UI dropdown hapus file
renderKaryawanTable();    // Render tabel karyawan

