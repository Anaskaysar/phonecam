<div align="center">

# Kaysarul Anas Apurba

**Applied ML & LLM Security · Backend & Cloud Engineering · Software Engineer**

M.Sc. Computational Sciences, Laurentian University (CGPA 9.10/10) · IEEE author · PhD applicant

[![Website](https://img.shields.io/badge/Website-research.kaysarulanas.me-0D1B2A?style=flat-square&logo=safari&logoColor=white)](https://research.kaysarulanas.me)
[![Google Scholar](https://img.shields.io/badge/Google_Scholar-Kaysarul_Anas_Apurba-4285F4?style=flat-square&logo=googlescholar&logoColor=white)](https://scholar.google.com/citations?user=7SJ63j0AAAAJ)
[![ORCID](https://img.shields.io/badge/ORCID-0009--0009--3647--2193-A6CE39?style=flat-square&logo=orcid&logoColor=white)](https://orcid.org/0009-0009-3647-2193)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-kaysarulanas-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://linkedin.com/in/kaysarulanas)
[![HuggingFace](https://img.shields.io/badge/HuggingFace-Kaysarulanas-FFD21E?style=flat-square&logo=huggingface&logoColor=black)](https://huggingface.co/Kaysarulanas)
[![Email](https://img.shields.io/badge/Email-kaysarulanas2@gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:kaysarulanas2@gmail.com)
[![CV](https://img.shields.io/badge/CV-PDF-555?style=flat-square&logo=readthedocs&logoColor=white)](https://research.kaysarulanas.me/assets/files/Kaysarul_Anas_Resume.pdf)

</div>

---

I'm an independent ML researcher and engineer. My work spans **LLM security, intrusion detection, information retrieval and medical image analysis**, with a focus on systems that are accurate *and* deployable in low-resource settings, then shipped to production.

Right now I'm hardening RAG systems against retrieval poisoning and prompt injection (accepted at **IEEE CIC 2026**), and working on automated malaria cell segmentation (**MalariAI**, under review at *Array*).

## 📰 Recent news

- **Sep 2026** · RAG-IDS paper **accepted** to the research track at **IEEE CIC 2026**. [arXiv](https://arxiv.org/abs/2608.08100)
- **Sep 2026** · Post-quantum migration for smart HVAC systems is on [arXiv](https://arxiv.org/abs/2609.27828), targeting *Symmetry* (MDPI)
- **Aug 2026** · **MalariAI** submitted to *Array* (Elsevier). [arXiv](https://arxiv.org/abs/2607.00385)
- **Aug 2026** · **SciRet** is on [arXiv](https://arxiv.org/abs/2608.03860), targeting COLING 2027
- **Jul 2026** · 🥉 **3rd Place Overall** at [CU Hacking 2026](https://cuhacking.ca/) (Ottawa) with **BioReact-Pi**
- **Jun 2026** · 🥈 **2nd Place** and **Best Use of NVIDIA** at Cursor Hackathon Sudbury 2026 with **Northern Shift Guard**

---

## 📄 Publications

| Year | Paper | Venue | Status |
| --- | --- | --- | --- |
| 2026 | **Defending Retrieval-Augmented Intrusion Detection Against Knowledge Poisoning and Prompt Injection**<br>**K. A. Apurba**, M. H. Hasan, M. Z. Moon, S. M. M. Rahman, A. Inomata<br>[arXiv](https://arxiv.org/abs/2608.08100) | IEEE CIC 2026 | ✅ Accepted |
| 2026 | **MalariAI: A Label-Resilient Decoupled Framework for Annotation-Agnostic Cell Segmentation and Explainable Stage Classification in Dense Malaria Blood Smears**<br>**K. A. Apurba**, M. H. Hasan, M. Ali, T. Rahman<br>[arXiv](https://arxiv.org/abs/2607.00385) · [Code](https://github.com/Anaskaysar/MalariAI-Automated-Malaria-Cell-Segmentation-from-Blood-Smear-Images) · [Demo](https://huggingface.co/spaces/Kaysarulanas/MalariAI) | *Array* (Elsevier) | 📤 Submitted |
| 2026 | **A Non-Invasive Cloud-Based Migration Strategy for Post-Quantum Cybersecurity in Smart HVAC Systems**<br>M. Z. Moon, **K. A. Apurba**, M. H. Hasan, S. M. M. Rahman<br>[arXiv](https://arxiv.org/abs/2609.27828) | *Symmetry* (MDPI) | 📝 Preprint |
| 2026 | **SciRet: A Compute-Aware Empirical Study of Retrieval and Reranking for Scientific RAG**<br>**K. A. Apurba**, M. H. Hasan, R. A. Shehab, A. Azad<br>[arXiv](https://arxiv.org/abs/2608.03860) | COLING 2027 | 📝 Preprint |
| 2023 | **Accurate Prediction of Pulmonary Fibrosis Progression Using EfficientNet and Quantile Regression**<br>R. A. Shehab, **K. A. Apurba**, M. Ahsanuzzaman, T. Rahman<br>[DOI](https://doi.org/10.1109/TENSYMP55890.2023.10223673) | IEEE TENSYMP 2023 | ✅ Published |

---

## 🔬 Research

### RAG-IDS · Dependable retrieval-augmented intrusion detection
[![IEEE CIC 2026](https://img.shields.io/badge/IEEE_CIC_2026-Accepted-2ea44f?style=flat-square)](https://arxiv.org/abs/2608.08100)

A 3-tier multi-agent RAG pipeline for network intrusion detection on CIC-UNSW-NB15 (3.54M flows, 10 attack classes), with a retrieval-boundary defense: trust scoring, label-embedding consistency checks and prompt sanitization.

- **30%+ F1** over tree-based ML baselines on select low-prevalence attack classes
- Recovers **up to 100%** of clean-baseline F1 under 1% knowledge-base poisoning
- Multi-document prompt-injection success held **below 2.4%**, at **under 5 ms** extra per query
- 4-bit 7B LLM on a single 16 GB GPU, with hybrid BGE-M3 + BM25 retrieval (reciprocal rank fusion)

`Python` `RAG` `LLM Security` `Multi-Agent` `BGE-M3` `BM25`

### [MalariAI](https://github.com/Anaskaysar/MalariAI-Automated-Malaria-Cell-Segmentation-from-Blood-Smear-Images) · Label-resilient malaria cell segmentation
[![Demo](https://img.shields.io/badge/Live_Demo-HuggingFace-FFD21E?style=flat-square&logo=huggingface&logoColor=black)](https://huggingface.co/spaces/Kaysarulanas/MalariAI)
[![arXiv](https://img.shields.io/badge/arXiv-2607.00385-B31B1B?style=flat-square&logo=arxiv&logoColor=white)](https://arxiv.org/abs/2607.00385)

Upload a Giemsa-stained blood smear and MalariAI segments the cells, finds the infected ones, computes the infection rate and the dominant parasite stage, with Grad-CAM++ explanations.

| Stage | Method | Result |
| --- | --- | --- |
| Cell isolation | Distance-transform guided watershed (annotation-agnostic) | **75.95% cell recovery** on NIH BBBC041 |
| Classification | EfficientNet-B0 + focal loss + Grad-CAM++ | **98.36% accuracy**, cross-validated on MP-IDB |

`Python` `PyTorch` `OpenCV` `EfficientNet` `Flask` `HuggingFace Spaces`

### SciRet · Retrieval and reranking for scientific RAG
[![arXiv](https://img.shields.io/badge/arXiv-2608.03860-B31B1B?style=flat-square&logo=arxiv&logoColor=white)](https://arxiv.org/abs/2608.03860)

A compute-aware empirical study of retrievers and rerankers for question answering over scientific literature.

`Python` `RAG` `Cross-encoder reranking` `BM25` `RAGAS`

### Post-quantum security for smart HVAC
[![arXiv](https://img.shields.io/badge/arXiv-2609.27828-B31B1B?style=flat-square&logo=arxiv&logoColor=white)](https://arxiv.org/abs/2609.27828)

A non-invasive cloud proxy that brings NIST post-quantum cryptography (ML-KEM, ML-DSA) to legacy smart HVAC systems without touching their hardware or firmware.

`Post-Quantum Cryptography` `ML-KEM` `ML-DSA` `Cloud`

---

## 🛠️ Projects

| Project | What it is | Links |
| --- | --- | --- |
| **PhoneCam** | Use your phone as a webcam with no app on the phone: scan a QR code and the picture goes peer-to-peer to your laptop. PWA, Chrome extension, Cloudflare Workers signalling | [Live](https://phonecam.app) · [GitHub](https://github.com/Anaskaysar/phonecam) |
| 🥉 **BioReact-Pi** | Edge-AI bioreactor controller on a Raspberry Pi: live temperature sensing, a logistic growth model for biomass, and a live dashboard. 3rd Place, CU Hacking 2026 (QNX challenge) | [GitHub](https://github.com/Anaskaysar/BioReact-Pi) · [Devpost](https://devpost.com/software/bioreactpi-an-edgeai-bioreactor-controller-on-raspberry-pi) |
| 🥈 **Northern Shift Guard** | Explainable AI safety for Northern Ontario mining sites: PPE and fatigue detection, zone-specific compliance, Nemotron reasoning and a local audit log. 2nd Place + Best Use of NVIDIA, Cursor Hackathon Sudbury 2026 | [Live](https://northern-shift-gaurd.onrender.com/) · [GitHub](https://github.com/Anaskaysar/Northern-Shift-Gaurd) |
| **JobTrackerr** | Production SaaS job tracker: Django REST + React (Vite), JWT and Google OAuth, AWS EC2 with Nginx/Gunicorn, CI/CD | [Live](https://jobtrackerr.com/) · [GitHub](https://github.com/Anaskaysar/JobTrackerr) |
| **EncryptIQ** | Interactive AES-128/256 and RSA-2048 visualiser with step-by-step encryption. Flask-RESTX + React | [Live](https://encryptiq.kaysarulanas.me/) · [GitHub](https://github.com/Anaskaysar/EncryptIQ) |

---

## 💼 Experience

**Contract AI Research Assistant** · Nexirion / Laurentian University · *May 2025 – present*
Multi-agent RAG for intrusion detection, adversarial defenses for retrieval, and memory-constrained LLM deployment.

**Undergraduate Research Assistant** · TnR Lab, North South University · *2022 – 2023*
Medical image analysis: data preprocessing, model training and evaluation.

## 🎓 Education & awards

- **M.Sc. Computational Sciences**, Laurentian University, Canada · 2023–2025 · CGPA 9.10/10
- **B.Sc. Computer Science and Engineering**, North South University, Bangladesh · 2018–2022
- 🏅 Mabel Jean and Bob Lye Memorial Award for Academic Excellence, Laurentian University (2024)
- 🥉 3rd Place Overall, CU Hacking 2026 · 🥈 2nd Place + Best Use of NVIDIA, Cursor Hackathon Sudbury 2026
- Top 10 of 80 teams, Innovation Challenge Season 11, North South University (2022)

---

## ⚙️ Tech stack

**ML / AI**

![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)
![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?style=flat-square&logo=tensorflow&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=flat-square&logo=scikit-learn&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat-square&logo=opencv&logoColor=white)
![HuggingFace](https://img.shields.io/badge/HuggingFace-FFD21E?style=flat-square&logo=huggingface&logoColor=black)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=flat-square&logo=langchain&logoColor=white)
![YOLO](https://img.shields.io/badge/YOLO-111F68?style=flat-square&logo=ultralytics&logoColor=white)

**Backend & Web**

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Django](https://img.shields.io/badge/Django-092E20?style=flat-square&logo=django&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=flat-square&logo=flask&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)

**Cloud, DevOps & tools**

![AWS](https://img.shields.io/badge/AWS-232F3E?style=flat-square&logo=amazon-aws&logoColor=white)
![GCP](https://img.shields.io/badge/GCP-4285F4?style=flat-square&logo=google-cloud&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=github-actions&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black)
![Raspberry Pi](https://img.shields.io/badge/Raspberry_Pi-A22846?style=flat-square&logo=raspberrypi&logoColor=white)
![LaTeX](https://img.shields.io/badge/LaTeX-008080?style=flat-square&logo=latex&logoColor=white)

---

## 📊 GitHub stats

<div align="center">

![GitHub Stats](https://github-readme-stats.vercel.app/api?username=Anaskaysar&show_icons=true&theme=tokyonight&hide_border=true&include_all_commits=true&count_private=true)
![Top Languages](https://github-readme-stats.vercel.app/api/top-langs/?username=Anaskaysar&layout=compact&theme=tokyonight&hide_border=true&langs_count=8)

</div>

---

<div align="center">

*Open to research and engineering roles, and to PhD opportunities in LLM security and cyber-physical systems.*

</div>
