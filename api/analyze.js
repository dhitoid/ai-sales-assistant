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
    const apiKey = process.env.GEMINI_API_KEY; // Diambil aman dari sistem Vercel

    if (!apiKey) {
        return res.status(500).json({ error: 'Server Error: API Key belum dikonfigurasi di Vercel.' });
    }

    if (!chatText) {
        return res.status(400).json({ error: 'Riwayat chat kosong.' });
    }

    const prompt = `
    Anda adalah asisten sales profesional. Analisis riwayat chat WhatsApp berikut ini antara sales dan calon pelanggan.
    
    Tugas:
    1. Tentukan status ketertarikan pelanggan: "Tertarik", "Ragu-ragu", atau "Menolak".
    2. Tentukan tanggal follow up yang pas (Format: DD MMM YYYY, misal: 25 Okt 2024). Jika menolak, isi: "Tidak Perlu".
    3. Buatkan draf balasan WhatsApp yang persuasif, sopan, natural, dan menggunakan bahasa Indonesia yang santai tapi profesional. Gunakan spasi/paragraf agar mudah dibaca.
    
    Riwayat Chat:
    "${chatText}"
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            status: { type: "STRING" },
                            follow_up_date: { type: "STRING" },
                            draft_reply: { type: "STRING" }
                        },
                        required: ["status", "follow_up_date", "draft_reply"]
                    }
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'Gagal menghubungi Gemini API' });
        }

        const resultText = data.candidates[0].content.parts[0].text;
        return res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        return res.status(500).json({ error: 'Terjadi kesalahan internal server.' });
    }
}
