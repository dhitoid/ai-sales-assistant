export default async function handler(req, res) {
    // Pengaturan CORS
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
        return res.status(500).json({ error: 'API Key belum dikonfigurasi di Environment Variables Vercel.' });
    }

    if (!chatText) {
        return res.status(400).json({ error: 'Riwayat chat kosong.' });
    }

    const prompt = `
    Anda adalah asisten sales profesional. Analisis riwayat chat WhatsApp berikut ini antara sales dan calon pelanggan.
    
    Tugas:
    1. Tentukan status ketertarikan pelanggan (Pilih salah satu: "Asli Tertarik", "Ragu-ragu", atau "Menolak").
    2. Tentukan tanggal follow up yang pas (Format: DD MMM YYYY, misal: 25 Okt 2026). Jika menolak, isi: "Tidak Perlu".
    3. Buatkan draf balasan WhatsApp yang persuasif, sopan, natural, dan menggunakan bahasa Indonesia yang santai tapi profesional. Gunakan spasi/paragraf agar mudah dibaca.
    
    Wajib berikan hasil analisa dalam format JSON murni dengan struktur persis seperti ini:
    {
        "status": "Isi status di sini",
        "follow_up_date": "Isi tanggal di sini",
        "draft_reply": "Isi draf text di sini"
    }

    Riwayat Chat:
    "${chatText}"
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'Gagal tersambung ke Google AI.' });
        }

        let resultText = data.candidates[0].content.parts[0].text;
        
        // Pembersihan total blok teks markdown agar aman dari error parsing
        resultText = resultText.replace(/```json/gi, '').replace(/
```/gi, '').trim();
        
        // Ekstraksi paksa menggunakan regex jika AI menyelipkan teks tambahan di luar kurung kurawal
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            resultText = jsonMatch[0];
        }

        const parsedResult = JSON.parse(resultText);
        return res.status(200).json(parsedResult);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'AI mengirimkan format data yang salah. Silakan coba klik tombol analisis lagi.' });
    }
}
