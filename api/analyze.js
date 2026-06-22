export default async function handler(req, res) {
    // Pengaturan CORS agar aman
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metode tidak diizinkan' });
    }

    const { chatText } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
        return res.status(500).json({ error: 'Server Error: API Key belum dikonfigurasi di Vercel.' });
    }

    if (!chatText) {
        return res.status(400).json({ error: 'Riwayat chat kosong.' });
    }

    // Prompt diperketat agar AI wajib memberikan format JSON murni
    const prompt = `
    Anda adalah asisten sales profesional. Analisis riwayat chat WhatsApp berikut ini antara sales dan calon pelanggan.
    
    Tugas:
    1. Tentukan status ketertarikan pelanggan: "Tertarik", "Ragu-ragu", atau "Menolak".
    2. Tentukan tanggal follow up yang pas (Format: DD MMM YYYY, misal: 25 Okt 2024). Jika menolak, isi: "Tidak Perlu".
    3. Buatkan draf balasan WhatsApp yang persuasif, sopan, natural, dan menggunakan bahasa Indonesia yang santai tapi profesional. Gunakan spasi/paragraf agar mudah dibaca.
    
    Wajib berikan hasil analisis dalam format JSON murni seperti struktur di bawah ini tanpa modifikasi:
    {
        "status": "Isi disini",
        "follow_up_date": "Isi disini",
        "draft_reply": "Isi disini"
    }

    Riwayat Chat:
    "${chatText}"
    `;

    try {
        // Kita gunakan request standar tanpa "generationConfig" agar tidak memicu error payload di Google
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'Gagal menghubungi Gemini API' });
        }

        let resultText = data.candidates[0].content.parts[0].text;
        
        // Membersihkan format markdown penulisan kode (```json ... ```) jika tidak sengaja dibuat oleh AI
        resultText = resultText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        
        // Mengubah teks bersih menjadi objek JSON formal
        const parsedResult = JSON.parse(resultText);
        return res.status(200).json(parsedResult);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Gagal memproses format data dari AI. Silakan coba lagi.' });
    }
}
