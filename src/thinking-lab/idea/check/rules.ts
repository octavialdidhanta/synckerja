// The exact rule of every Idea check. The model judges with these words, and the page's "i" popover
// and the MCP server show them. Relative imports only: the MCP server loads this file.
import type { IdeaCheckId } from "./ids";

export const IDEA_CHECK_RULES: Readonly<Record<IdeaCheckId, readonly string[]>> = {
  proposal: [
    "Lolos hanya jika kalimatnya satu usulan spesifik dalam bentuk \"Kita [bikin/ajak/tunjukkan/ciptakan] … sehingga …\": menyebut apa yang dibuat, diajak, ditunjukkan, atau diciptakan, lalu apa yang menjadi benar karenanya.",
    "Gagal jika isinya hanya fakta, wawasan, masalah, tujuan, strategi umum, aktivitas, atau teknik, atau jika tidak menyebut tindakannya sekaligus apa yang menjadi benar. Unsur-unsur itu boleh ada di dalam usulan, asal bukan seluruh isinya.",
    "Jangan gagalkan hanya karena tindakannya tidak biasa.",
  ],
  mechanism: [
    "Lolos hanya jika ini mekanisme yang membuat Angle terjadi, terlihat, atau terbukti, lewat salah satu kendaraan ini: perbandingan, eksperimen, demonstrasi, atau situasi.",
    "Situasi boleh berlanjut: akibat yang baru terlihat seiring waktu tetap situasi, asalkan titik baliknya disebabkan subjek Master Thought.",
    "Orang lain harus bisa mengenali mekanismenya, dan batasnya jelas.",
    "Gagal jika masih berupa pengamatan, nama ruang, alasan \"karena\", cerita jadi dengan alur dan dialog, metafora, pelajaran, grafik, daftar shot, atau bentuk produksi lain. Gagal juga jika mekanismenya terlalu kabur untuk dibatasi.",
  ],
  result: [
    "Lolos hanya jika kalimat menyebut apa yang menjadi benar, dan hal itu memang mengikuti dari mekanismenya, sehingga alasan Big Thought terjadi di depan penonton.",
    "Gagal jika hasilnya tidak mengikuti dari mekanisme, ada kontradiksi, atau kalimat menjelaskan Big Thought dengan kata-kata alih-alih menyebut apa yang menjadi benar.",
    "Gagal jika kalimat mengumumkan kesimpulan dengan \"menunjukkan bahwa\", \"membuktikan bahwa\", atau \"menyoroti bahwa\".",
    "Jangan gagalkan hanya karena mekanismenya tidak menyelesaikan seluruh masalah di Angle.",
  ],
  stakeHolds: [
    "Lolos hanya jika Idea ini berhenti masuk akal ketika taruhan khas Angle, atau Territory, Big Thought, dan Master Thought di atasnya, dicabut, dan Idea ini menopang isi tersimpan masing-masing level itu.",
    "Gagal jika kalimatnya tetap berdiri sebagai Idea walaupun taruhan itu dicabut, atau tidak nyambung ke Master Thought, Big Thought, atau Territory yang tersimpan.",
  ],
  causeLock: [
    "Lolos hanya jika penjelasan lain yang mungkin dipikirkan penonton sudah ditutup, sehingga subjek Master Thought menjadi satu-satunya penyebab yang masuk akal.",
    "Jika kunci ditulis, setiap kunci menyebut satu penjelasan lain dan cara Idea menutupnya. Jika kunci belum ditulis, nilai dari kalimat Idea itu sendiri.",
    "Gagal jika masih ada penjelasan lain yang terbuka, atau kunci hanya bilang ini menunjukkan, membuktikan, atau menyoroti kesimpulan.",
  ],
  watchable: [
    "Lolos jika audiens yang tersimpan bisa menonton atau ikut di waktu yang memang sudah mereka pakai, tanpa harus punya produk, keterampilan, profesi, atau komitmen baru.",
    "Video, cerita, demonstrasi, atau percakapan yang bisa ditonton, didengar, dibaca, atau diikuti selalu lolos. Kerja orang di dalam konten bukan kebiasaan yang harus diadopsi audiens.",
    "Gagal hanya jika audiens ini sendiri harus punya produk, keterampilan, profesi, atau komitmen yang tidak bisa mereka siapkan dari hidup mereka sekarang, atau Idea ini bergantung pada perilaku audiens yang tidak realistis.",
    "Kenali audiens hanya dari teks Master Thought yang tersimpan: audiens, keyakinan lama, dan keyakinan dasar. Jangan mengarang audiens dari Idea, Territory, Angle, atau Big Thought.",
  ],
  distinct: [
    "Lolos jika prinsip kerjanya, atau apa yang dilakukan audiens, berbeda dari setiap Idea lain yang sudah lolos, termasuk yang terkunci. Aksi yang berbeda (bercerita, mencatat, membandingkan, bertanya, melihat, berdiskusi) berarti Idea yang berbeda.",
    "Gagal hanya jika alasannya menyebut Idea lain itu, dan prinsip kerja serta apa yang dilakukan audiens sama, sehingga pengalamannya tidak bisa dibedakan. Beda judul, kata, visualisasi, atau penekanan saja tetap Idea yang sama.",
    "Topik, Big Thought, atau Angle yang sama bukan alasan gagal.",
  ],
};
