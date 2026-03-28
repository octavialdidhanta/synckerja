import React from "react";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OnboardingSplitLayout } from "@/0-onboarding/components/OnboardingSplitLayout";

export default function TermsAndConditionsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <OnboardingSplitLayout fillViewport scrollClassName="items-start">
      <div className="mx-auto w-full max-w-6xl pb-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-6 flex w-full justify-center">
            <img src="/favicon.png" alt="" className="h-12 w-auto" width={48} height={48} />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            Syarat dan Ketentuan / Terms and Conditions
          </h1>
          <p className="text-sm text-slate-600">PT Integrasi Visual Digital Indonesia (Office.Synckerja)</p>
        </div>

        {/* Introduction */}
        <div className="mb-8 space-y-4">
          <p className="text-slate-700 leading-relaxed">
            Mohon membaca Syarat dan Ketentuan ini dengan saksama sebelum menggunakan layanan Penyedia dan dengan mengakses atau 
            menggunakan layanan Penyedia, Pengguna setuju untuk terikat oleh syarat dan ketentuan ini dan jika Pengguna tidak setuju 
            dengan bagian mana pun dari Syarat dan Ketentuan ini, maka Pengguna tidak diperbolehkan mengakses layanan.
          </p>
          <p className="text-slate-700 leading-relaxed">
            Syarat dan Ketentuan ini adalah Pengikatan kontrak yang mengatur hubungan hukum antara Pengguna dengan Penyedia Platform 
            PT Integrasi Visual Digital Indonesia (Office.Synckerja) sebagai Pemilik dan Pengembang Platform. Dengan membaca, memahami, 
            mengklik persetujuan, dan menggunakan Platform ini, maka dengan ini Pengguna telah setuju dan sepakat untuk tunduk terhadap 
            Syarat dan Ketentuan yang telah ditetapkan Penyedia Platform.
          </p>
        </div>

        {/* Content in two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Indonesian */}
          <div className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">PENDAHULUAN</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Syarat dan Ketentuan Layanan ini diatur dan diinterpretasikan berdasarkan Hukum Negara Republik Indonesia. 
                    Pengguna dengan ini sepakat untuk tunduk kepada Hukum yang berlaku di Negara Republik Indonesia.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Penyedia dapat mengubah atau memperbarui Syarat dan Ketentuan ini setiap waktu dengan mencantumkan Syarat dan 
                    Ketentuan yang telah diubah atau diperbarui di dalam Platform, dan Pengguna diwajibkan untuk setiap saat membaca 
                    persyaratan dan ketentuan baru dan Pengguna dianggap telah menyetujui dan menyepakati perubahan atau pembaruan 
                    tersebut apabila setelah dicantumkan di dalam Platform.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">KETENTUAN UMUM LAYANAN</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed mb-2">
                    Dengan Menyelesaikan Proses Pendaftaran, Membuat Akun, Mengakses Dan/Atau Menggunakan Platform Maupun Layanan, 
                    Pengguna Menyatakan Bahwa:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-slate-700">
                    <li>Pengguna telah membaca, memahami, dan menyetujui untuk terikat pada Syarat dan Ketentuan Layanan ini.</li>
                    <li>Pengguna memiliki usia yang cukup berdasarkan Hukum yang berlaku untuk mengikatkan diri dengan Syarat dan ketentuan Layanan.</li>
                    <li>Informasi yang Pengguna berikan sehubungan dengan Pendaftaran Pengguna untuk Platform/Layanan Sudah Benar, Akurat, dan Lengkap.</li>
                    <li>Pengguna memiliki wewenang untuk menyetujui Ketentuan Layanan ini atas Nama Pribadi maupun atas Nama Entitas Bisnis yang Pengguna Daftarkan Sebagai Pengguna, dan Pengguna maupun Entitas bisnis Pengguna terikat dalam Syarat dan Ketentuan ini.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pengguna bertanggung jawab atas aktivitas yang dilakukan dengan akun Pengguna pada Platform ini.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Penyedia berhak mengubah atau memperbarui Syarat dan Ketentuan ini kapan saja tanpa pemberitahuan sebelumnya. 
                    Penggunaan lanjutan terhadap Platform dianggap sebagai persetujuan atas perubahan tersebut.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">4.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pengguna mengetahui dan menyetujui bahwa harga yang tercantum pada Platform ini dapat mengalami perubahan 
                    sewaktu-waktu dan tanpa pemberitahuan terlebih dahulu kepada Pengguna.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">5.</p>
                  <p className="text-slate-700 leading-relaxed mb-2">
                    Pengguna tidak diperkenankan untuk memuat dan menerbitkan konten yang:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-slate-700">
                    <li>Melanggar hak cipta, paten, merek dagang, merek layanan, rahasia dagang, atau hak kepemilikan lainnya.</li>
                    <li>Mengancam, tidak senonoh, pornografi atau bisa menimbulkan segala sanksi Hukum perdata atau pidana Indonesia atau hukum internasional.</li>
                    <li>Mengandung bug, virus, worm, pintu perangkap, trojan horse atau kode dan properti berbahaya lainnya.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">6.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Setiap Pengguna berkewajiban untuk membayar penuh atas pembayaran layanan ini sesuai dengan ketentuan transaksi dan pembayaran.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">7.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Setiap Pengguna bertanggung jawab atas seluruh hal yang dilakukan di Platform ini.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">8.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Setiap Pengguna bertanggung jawab sepenuhnya jika Pengguna melakukan pelanggaran terhadap ketentuan-ketentuan 
                    yang telah ditetapkan dalam Syarat dan Ketentuan Layanan ini, dan Pengguna menyetujui untuk melepaskan Penyedia 
                    beserta afiliasinya atas seluruh kerugian yang diakibatkan oleh pelanggaran yang dilakukan oleh Pengguna.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">DEFINISI</h2>
              <div className="space-y-2 text-slate-700">
                <p>• Platform adalah Situs web, aplikasi, atau layanan digital yang disediakan oleh Penyedia.</p>
                <p>• Penyedia adalah PT Integrasi Visual Digital Indonesia (Office.Synckerja) selaku Pemilik dan Pengembang Platform.</p>
                <p>• Pengguna adalah Setiap individu atau entitas yang mengakses atau menggunakan Platform.</p>
                <p>• Konten adalah Segala bentuk informasi, data, teks, gambar, video, atau materi lain yang dipublikasikan di Platform.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">JANGKA WAKTU LAYANAN</h2>
              <p className="text-slate-700 leading-relaxed">
                Layanan ini akan berlaku dan efektif sejak tanggal dibayarkannya biaya berlangganan oleh Pengguna dan akan 
                berlangsung selama jangka waktu yang dipilih dan dapat diperpanjang sebelum berakhirnya jangka waktu.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">BIAYA LAYANAN DAN TATA CARA PEMBAYARAN</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pengguna wajib membayar biaya Layanan kepada Penyedia Layanan sejumlah sesuai dengan Biaya Paket Platform yang Pengguna pilih.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pembayaran dilakukan pada awal masa berlangganan sesuai dengan pilihan masa berlangganan dan selama masa Syarat dan Ketentuan ini berlaku.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Setiap Pengguna berhak untuk memilih metode pembayaran yang telah disediakan oleh Penyedia.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">4.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pembayaran dilakukan melalui Transfer Bank, Virtual Account, maupun tata cara pembayaran yang telah disediakan oleh Penyedia.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">5.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Penyedia dan Pengguna akan membayar Pajak yang berlaku sesuai dengan ketentuan peraturan perundang-undangan.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">HAK KEKAYAAN INTELEKTUAL</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Seluruh Hak atas Kekayaan Intelektual adalah milik Penyedia Layanan dan dilindungi oleh Undang-Undang yang berlaku.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Semua hak cipta, merek dagang, dan hak kekayaan intelektual dalam Platform adalah milik Penyedia.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pengguna tidak diperkenankan menggunakan logo, nama dagang, atau desain Penyedia tanpa izin resmi.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">KERAHASIAAN</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Penyedia dan Pengguna akan menjaga kerahasiaan semua informasi non-publik, baik lisan maupun tertulis yang dimiliki 
                    oleh Penyedia Layanan termasuk dalam merekayasa, memodifikasi dan membuat karya yang sama dan turunan berdasarkan 
                    platform milik Penyedia Layanan yang diungkapkan sehubungan dengan Syarat dan Ketentuan ini.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Penyedia dan Pengguna mematuhi aturan hukum yang berlaku termasuk Undang-Undang Perlindungan Data Pribadi atau 
                    aturan lain yang berlaku di Republik Indonesia.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pengguna menyatakan tidak akan menggunakan jasa Penyedia Layanan dan tidak akan menyebarkan data milik Penyedia 
                    Layanan jika Pengguna adalah pesaing atau yang berafiliasi dengan para pesaing Penyedia Layanan.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">4.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pengguna tidak akan menggunakan fitur kecerdasan buatan demi menjaga kerahasiaan layanan.
                  </p>
                </div>
                <div className="mt-4">
                  <p className="text-slate-700 leading-relaxed mb-2">Informasi Rahasia tidak mencakup informasi sebagai berikut:</p>
                  <ul className="list-disc pl-6 space-y-1 text-slate-700">
                    <li>Telah menjadi domain publik tanpa pelanggaran oleh Pengguna.</li>
                    <li>Telah diketahui secara sah oleh Pengguna sebelum pengungkapan oleh pengungkap.</li>
                    <li>Diungkapkan secara sah kepada Pengguna oleh pihak ketiga tanpa batasan.</li>
                    <li>Diwajibkan untuk diungkapkan demi kepentingan hukum atau kepentingan pada pengadilan.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">PENGAKHIRAN</h2>
              <div className="space-y-4">
                <p className="text-slate-700 leading-relaxed">Syarat dan Ketentuan dianggap berakhir apabila:</p>
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Jangka Waktu Syarat dan Ketentuan ini berakhir.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pengguna melanggar ketentuan Syarat dan Ketentuan ini dan tidak memperbaiki pelanggaran dalam 17 (tujuh belas) 
                    hari setelah menerima pemberitahuan tertulis tentang pelanggaran, termasuk jika Pengguna terlambat melakukan 
                    pembayaran sesuai jadwal.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Terjadi keadaan Kahar (Force Majeure) yang menyebabkan tidak dapat melanjutkan kewajibannya selama lebih dari 
                    14 (empat belas) hari.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">4.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pengguna berkewajiban untuk membayar seluruh biaya layanan yang telah berjalan sampai dengan waktu Syarat dan 
                    Ketentuan ini berakhir apabila berkeinginan mengakhiri Syarat dan Ketentuan sebelum jangka waktu berakhir.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">5.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pengguna bersedia ditangguhkan hak atas layanannya apabila terindikasi melanggar Syarat dan Ketentuan dan 
                    melakukan tindak pidana serta tidak akan menerima hak layanan apapun dari Penyedia Layanan.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">6.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pemutusan atau pemblokiran hak atas layanan dilakukan setelah Pengguna tidak mengaktifkannya selama 90 hari.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">SANKSI</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pengguna bersedia menerima sanksi apabila melanggar sebagian maupun seluruh aturan yang ada pada Syarat dan 
                    Ketentuan ini sesuai dengan jumlah kerugian yang nyata-nyata dialami oleh Penyedia atas Pelanggaran tersebut 
                    sesuai aturan hukum yang berlaku.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Pengguna akan mengganti rugi terhadap setiap pelanggaran Hak atas kekayaan intelektual sesuai dengan aturan yang berlaku.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">PENYELESAIAN PERSELISIHAN</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Setiap perselisihan, perbedaan pendapat, atau klaim yang timbul dari atau sehubungan dengan Syarat dan Ketentuan 
                    ini akan diselesaikan terlebih dahulu secara musyawarah untuk mencapai mufakat.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Apabila penyelesaian secara musyawarah tidak tercapai dalam waktu 14 (empat belas) hari, maka Penyedia dan 
                    Pengguna sepakat untuk menyelesaikan perselisihan melalui Pengadilan Negeri Jakarta Selatan.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">KEADAAN KAHAR</h2>
              <p className="text-slate-700 leading-relaxed">
                Pemberi dan Pengguna tidak akan bertanggung jawab atas kegagalan atau keterlambatan dalam melaksanakan kewajiban 
                berdasarkan Syarat dan Ketentuan ini jika kegagalan atau keterlambatan tersebut dapat dibuktikan disebabkan oleh 
                peristiwa di luar kendali wajar, termasuk namun tidak terbatas pada bencana alam, perang, huru-hara, kebakaran, 
                banjir, gempa bumi, pandemi, atau tindakan pemerintah termasuk pada perubahan aturan, perizinan, dan terkena dampak 
                Keadaan Kahar harus segera memberitahukan yang lainnya secara tertulis mengenai terjadinya keadaan Kahar dengan 
                jangka selambat-lambatnya waktu 7 (tujuh) hari.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">LAIN-LAIN</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Keseluruhan Syarat dan Ketentuan ini merupakan keseluruhan Syarat dan Ketentuan antara Penyedia dan Pengguna 
                    dan menggantikan semua perjanjian, komunikasi, dan kesepahaman sebelumnya, baik lisan maupun tertulis, 
                    sehubungan dengan materi pokok Syarat dan Ketentuan ini.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Setiap perubahan atau amandemen terhadap Syarat dan Ketentuan ini harus dibuat secara tertulis dan ditandatangani.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Jika ada ketentuan dalam Syarat dan Ketentuan ini yang dinyatakan tidak sah, ilegal, atau tidak dapat diberlakukan 
                    oleh pengadilan yang berwenang, maka ketentuan tersebut akan dianggap terpisah dari Syarat dan Ketentuan ini dan 
                    tidak akan memengaruhi validitas dan keberlakuan ketentuan lainnya.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">4.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Syarat dan Ketentuan ini diatur dan ditafsirkan sesuai dengan hukum Republik Indonesia.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">5.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Semua pemberitahuan atau komunikasi yang diperlukan atau diizinkan berdasarkan Syarat dan Ketentuan ini harus 
                    dibuat secara tertulis dan dikirimkan ke alamat yang disebutkan di awal Syarat dan Ketentuan ini.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">6.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Tidak ada yang dapat mengalihkan hak atau kewajibannya berdasarkan Syarat dan Ketentuan ini tanpa persetujuan 
                    tertulis sebelumnya.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="mt-8 p-4 bg-slate-50 rounded-lg">
                <p className="text-slate-700 leading-relaxed">
                  Saya selaku Pengguna telah setuju syarat dan ketentuan tersebut di atas [ ]
                </p>
              </div>
            </section>
          </div>

          {/* Right Column - English */}
          <div className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">INTRODUCTION</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    These Terms and Conditions of Service are governed by and interpreted under the laws of the Republic of Indonesia. 
                    Users hereby agree to comply with the laws applicable in the Republic of Indonesia.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    The Provider may change or update these Terms and Conditions at any time by listing the changed or updated Terms 
                    and Conditions on the Platform, and Users are required to read the new terms and conditions at all times and Users 
                    are deemed to have agreed to and consented to such changes or updates if they are listed on the Platform.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">GENERAL TERMS OF SERVICE</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed mb-2">
                    By Completing the Registration Process, Creating an Account, Accessing And/Or Using the Platform or Services, 
                    the User Represents That:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-slate-700">
                    <li>The User has read, understood, and agreed to be bound by these Terms and Conditions of Service.</li>
                    <li>The User is of sufficient age under applicable law to bind themselves to the Terms and Conditions of Service.</li>
                    <li>Information that the User provides in connection with User Registration for the Platform/Service is Correct, Accurate, and Complete.</li>
                    <li>The User has the authority to agree to these Terms of Service on behalf of themselves or on behalf of the Business Entity that the User registers as a User, and the User or User business entity is bound by these Terms and Conditions.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Users are responsible for activities carried out with their User account on this Platform.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    The Provider has the right to change or update these Terms and Conditions at any time without prior notice. 
                    Continued use of the Platform is deemed as acceptance of such changes.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">4.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Users acknowledge and agree that prices listed on this Platform may change at any time without prior notice to Users.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">5.</p>
                  <p className="text-slate-700 leading-relaxed mb-2">
                    Users are not permitted to upload and publish content that:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-slate-700">
                    <li>Violates copyrights, patents, trademarks, service marks, trade secrets, or other proprietary rights.</li>
                    <li>Is threatening, indecent, pornographic or could result in any civil or criminal legal sanctions under Indonesian or international law.</li>
                    <li>Contains bugs, viruses, worms, trapdoors, trojan horses or other harmful codes and properties.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">6.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Every User is obligated to pay in full for payment of this service in accordance with transaction and payment terms.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">7.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Every User is responsible for all activities carried out on this Platform.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">8.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Every User is fully responsible if the User violates the provisions set forth in these Terms and Conditions of Service, 
                    and the User agrees to release the Provider and its affiliates from all losses caused by violations committed by the User.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">DEFINITIONS</h2>
              <div className="space-y-2 text-slate-700">
                <p>• Platform is a website, application, or digital service provided by the Provider.</p>
                <p>• Provider is PT Integrasi Visual Digital Indonesia (Office.Synckerja) as the Platform Owner and Developer.</p>
                <p>• User is any individual or entity that accesses or uses the Platform.</p>
                <p>• Content is any form of information, data, text, images, videos, or other material published on the Platform.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">SERVICE TERM</h2>
              <p className="text-slate-700 leading-relaxed">
                This service will be valid and effective from the date the subscription fee is paid by the User and will last for the 
                selected period and can be extended before the end of the period.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">SERVICE FEES AND PAYMENT PROCEDURES</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Users are required to pay Service fees to the Service Provider in accordance with the Platform Package Fee chosen by the User.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Payment is made at the beginning of the subscription period according to the subscription period choice and during the period these Terms and Conditions are in effect.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Every User has the right to choose the payment method provided by the Provider.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">4.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Payment is made through Bank Transfer, Virtual Account, or payment procedures provided by the Provider.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">5.</p>
                  <p className="text-slate-700 leading-relaxed">
                    The Provider and User will pay applicable taxes in accordance with statutory regulations.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">INTELLECTUAL PROPERTY RIGHTS</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    All Intellectual Property Rights belong to the Service Provider and are protected by applicable laws.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    All copyrights, trademarks, and intellectual property rights in the Platform belong to the Provider.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Users are not permitted to use the Provider's logo, trade name, or design without official permission.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">CONFIDENTIALITY</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    The Provider and User will maintain the confidentiality of all non-public information, both oral and written, 
                    owned by the Service Provider including in engineering, modifying and creating the same and derivative works 
                    based on the Service Provider's platform disclosed in connection with these Terms and Conditions.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    The Provider and User comply with applicable legal rules including the Personal Data Protection Law or other 
                    rules applicable in the Republic of Indonesia.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Users declare that they will not use the Service Provider's services and will not distribute the Service Provider's 
                    data if the User is a competitor or affiliated with the Service Provider's competitors.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">4.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Users will not use artificial intelligence features to maintain service confidentiality.
                  </p>
                </div>
                <div className="mt-4">
                  <p className="text-slate-700 leading-relaxed mb-2">Confidential Information does not include information that:</p>
                  <ul className="list-disc pl-6 space-y-1 text-slate-700">
                    <li>Has become public domain without violation by the User.</li>
                    <li>Has been legally known by the User before disclosure by the discloser.</li>
                    <li>Is legally disclosed to the User by a third party without restriction.</li>
                    <li>Is required to be disclosed for legal interests or court interests.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">TERMINATION</h2>
              <div className="space-y-4">
                <p className="text-slate-700 leading-relaxed">These Terms and Conditions are deemed to end if:</p>
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    The Term of these Terms and Conditions expires.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    The User violates the provisions of these Terms and Conditions and does not correct the violation within 17 
                    (seventeen) days after receiving written notification of the violation, including if the User is late in making 
                    payments according to schedule.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Force Majeure occurs that causes inability to continue obligations for more than 14 (fourteen) days.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">4.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Users are obligated to pay all service fees that have been running until the time these Terms and Conditions 
                    end if they wish to terminate the Terms and Conditions before the term expires.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">5.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Users are willing to have their service rights suspended if they are indicated to violate the Terms and Conditions 
                    and commit criminal acts and will not receive any service rights from the Service Provider.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">6.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Termination or blocking of service rights is carried out after the User has not activated it for 90 days.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">SANCTIONS</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Users are willing to accept sanctions if they violate part or all of the rules in these Terms and Conditions 
                    according to the amount of actual losses experienced by the Provider due to such violations according to applicable legal rules.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Users will compensate for any violation of intellectual property rights in accordance with applicable rules.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">DISPUTE RESOLUTION</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Any dispute, difference of opinion, or claim arising from or in connection with these Terms and Conditions will 
                    first be resolved through deliberation to reach consensus.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    If deliberation resolution is not reached within 14 (fourteen) days, then the Provider and User agree to resolve 
                    disputes through the South Jakarta District Court.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">FORCE MAJEURE</h2>
              <p className="text-slate-700 leading-relaxed">
                The Provider and User will not be responsible for failure or delay in performing obligations under these Terms and 
                Conditions if such failure or delay can be proven to be caused by events beyond reasonable control, including but not 
                limited to natural disasters, war, riots, fire, floods, earthquakes, pandemics, or government actions including changes 
                in regulations, permits, and those affected by Force Majeure must immediately notify the other in writing regarding the 
                occurrence of Force Majeure within a maximum period of 7 (seven) days.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">MISCELLANEOUS</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-slate-900 mb-2">1.</p>
                  <p className="text-slate-700 leading-relaxed">
                    These entire Terms and Conditions constitute the entire Terms and Conditions between the Provider and User and 
                    replace all previous agreements, communications, and understandings, both oral and written, in connection with the 
                    subject matter of these Terms and Conditions.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">2.</p>
                  <p className="text-slate-700 leading-relaxed">
                    Any changes or amendments to these Terms and Conditions must be made in writing and signed.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">3.</p>
                  <p className="text-slate-700 leading-relaxed">
                    If any provision in these Terms and Conditions is declared invalid, illegal, or unenforceable by a competent court, 
                    then such provision will be deemed separate from these Terms and Conditions and will not affect the validity and 
                    enforceability of other provisions.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">4.</p>
                  <p className="text-slate-700 leading-relaxed">
                    These Terms and Conditions are governed by and interpreted in accordance with the laws of the Republic of Indonesia.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">5.</p>
                  <p className="text-slate-700 leading-relaxed">
                    All notices or communications required or permitted under these Terms and Conditions must be made in writing and 
                    sent to the address mentioned at the beginning of these Terms and Conditions.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900 mb-2">6.</p>
                  <p className="text-slate-700 leading-relaxed">
                    No one may transfer their rights or obligations under these Terms and Conditions without prior written consent.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="mt-8 p-4 bg-slate-50 rounded-lg">
                <p className="text-slate-700 leading-relaxed">
                  I as a User have agreed to the terms and conditions above [ ]
                </p>
              </div>
            </section>
          </div>
        </div>

        {/* Navigation Button */}
        <div className="mt-12 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/create-organization")}
            className="flex h-12 items-center gap-2 border-2 border-[hsl(var(--brand-blue))] font-semibold text-[hsl(var(--brand-blue))] hover:bg-[hsl(var(--brand-blue))]/10"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("onboarding.terms.backToOrg")}
          </Button>
        </div>
      </div>
    </OnboardingSplitLayout>
  );
}
