import type { Metadata } from "next";
import Link from "next/link";
import { ContactFormulier } from "@/components/public/ContactFormulier";
import "./website.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.tafelvrij.be"),
  title: { absolute: "Tafelvrij | Eenvoudig reservatiesysteem voor restaurants" },
  description: "Ontvang online reservaties via je restaurantwebsite, beheer je shiften en zie vooraf hoeveel gasten het menu nemen. Ontdek Tafelvrij.",
  alternates: { canonical: "https://www.tafelvrij.be/" },
  openGraph: {
    type: "website", locale: "nl_BE", url: "https://www.tafelvrij.be/",
    siteName: "Tafelvrij", title: "Tafelvrij | Eenvoudig reserveren voor restaurants",
    description: "Meer overzicht voor je restaurant. Minder administratie, meer gastvrijheid.",
    images: [{ url: "/tafelvrij-social.png", width: 1200, height: 630, alt: "Tafelvrij — meer tijd voor wat telt" }],
  },
  twitter: { card: "summary_large_image", title: "Tafelvrij | Eenvoudig reserveren voor restaurants", description: "Meer overzicht voor je restaurant. Minder administratie, meer gastvrijheid.", images: ["/tafelvrij-social.png"] },
};

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": "https://hawk-ict.be/#organisatie", name: "Hawk-ICT", url: "https://hawk-ict.be/" },
    { "@type": "WebSite", "@id": "https://www.tafelvrij.be/#website", url: "https://www.tafelvrij.be/", name: "Tafelvrij", inLanguage: "nl-BE" },
    { "@type": "SoftwareApplication", "@id": "https://www.tafelvrij.be/#tafelvrij", name: "Tafelvrij", url: "https://www.tafelvrij.be/", applicationCategory: "BusinessApplication", operatingSystem: "Web", inLanguage: "nl-BE", description: "Een online reservatiesysteem voor restaurants met een boekingswidget, shiftbeheer en inzicht in menukeuzes.", creator: { "@id": "https://hawk-ict.be/#organisatie" } },
  ],
};

const voordelen = [
  { nummer: "01", icoon: "↗", titel: "Reservaties, zonder omwegen", tekst: "Laat gasten eenvoudig een tafel boeken via je eigen website. Jij houdt de touwtjes in handen." },
  { nummer: "02", icoon: "◷", titel: "Overzicht voor elke service", tekst: "Zie wie er komt, wanneer ze komen en hoeveel gasten het menu nemen. Rust in de zaal én de keuken." },
  { nummer: "03", icoon: "✳", titel: "Persoonlijk voor jouw zaak", tekst: "Stel je shiften en capaciteit in, beheer uitzonderingen en geef je boekingswidget jouw uitstraling." },
];

export default function Home() {
  return <div className="tv-site">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <header className="tv-header">
      <div className="tv-container tv-header-inner">
        <Link href="/" className="tv-logo" aria-label="Tafelvrij startpagina"><span className="tv-logo-mark" aria-hidden="true">✳</span> tafelvrij<span className="tv-logo-dot">.</span></Link>
        <nav className="tv-nav" aria-label="Hoofdnavigatie">
          <a href="#voordelen">Voordelen</a><a href="#werking">Hoe het werkt</a><a href="#contact">Contact</a>
        </nav>
        <div className="tv-header-actions"><Link href="/login" className="tv-login">Inloggen <span aria-hidden="true">↗</span></Link><a className="tv-header-cta" href="#contact">Maak kennis <span aria-hidden="true">↗</span></a></div>
      </div>
    </header>

    <main>
      <section className="tv-hero">
        <div className="tv-container tv-hero-grid">
          <div className="tv-hero-copy">
            <p className="tv-eyebrow"><span className="tv-dot" /> GEMAAKT VOOR RESTAURANTS</p>
            <h1>Meer tijd voor<br /><em>wat telt.</em></h1>
            <p className="tv-hero-intro">Tafelvrij is een eenvoudig online reservatiesysteem voor restaurants. Ontvang boekingen via je website en zie vooraf hoeveel gasten het menu nemen.</p>
            <div className="tv-hero-buttons"><a className="tv-button tv-button-dark" href="#contact">Ontdek Tafelvrij <span aria-hidden="true">↗</span></a><a className="tv-text-link" href="#werking">Zo werkt het <span aria-hidden="true">↓</span></a></div>
            <div className="tv-hero-note"><span className="tv-note-icon">✳</span><span>Eenvoudig in gebruik.<br /><strong>Gemaakt voor de horeca.</strong></span></div>
          </div>
          <div className="tv-hero-art" aria-label="Illustratie van een reservatieoverzicht" role="img">
            <div className="tv-art-orbit tv-art-orbit-one" /><div className="tv-art-orbit tv-art-orbit-two" />
            <div className="tv-floating-badge"><span>✦</span> MEER RUST IN JE ZAAK</div>
            <div className="tv-dashboard">
              <div className="tv-dash-top"><span className="tv-dash-logo">✳ <strong>tafelvrij.</strong></span><span className="tv-dash-dots">● ● ●</span></div>
              <div className="tv-dash-body">
                <div className="tv-dash-head"><div><small>GOEDEMORGEN!</small><h2>Jouw dagoverzicht</h2></div><div className="tv-dash-calendar">▦</div></div>
                <p className="tv-dash-sub">Een blik op de komende service</p>
                <div className="tv-dash-stats"><div><small>GASTEN</small><strong>24</strong><span>vandaag verwacht</span></div><div><small>MENU&apos;S</small><strong>16</strong><span>voor de keuken</span></div><div><small>RESERVATIES</small><strong>8</strong><span>vandaag</span></div></div>
                <div className="tv-dash-list-title"><strong>Op de planning</strong><span>Vandaag ↗</span></div>
                <div className="tv-dash-row"><span className="tv-time">12:00</span><span><b>Familie Peeters</b><small>4 gasten</small></span><span className="tv-menu-pill">Menu</span></div>
                <div className="tv-dash-row"><span className="tv-time">12:30</span><span><b>Julie Vermeulen</b><small>2 gasten</small></span><span className="tv-menu-pill neutral">À la carte</span></div>
                <div className="tv-dash-row"><span className="tv-time">13:00</span><span><b>Thomas Jacobs</b><small>6 gasten</small></span><span className="tv-menu-pill">Menu</span></div>
              </div>
            </div>
            <div className="tv-floating-confirm"><span>✓</span><div><b>Nieuwe reservatie</b><small>Je tafel is geboekt!</small></div></div>
            <p className="tv-art-caption">EEN FRISSE BLIK OP RESERVEREN <span>✳</span></p>
          </div>
        </div>
      </section>

      <div className="tv-ribbon"><div className="tv-container"><span>VOOR RESTAURANTS DIE LIEVER ONTVANGEN DAN ADMINISTREREN</span><span aria-hidden="true">✳</span><span>EENVOUD IN ELKE SERVICE</span></div></div>

      <section id="voordelen" className="tv-section tv-benefits"><div className="tv-container">
        <div className="tv-section-heading"><div><p className="tv-eyebrow">MINDER KLIKKEN. MEER KOKEN.</p><h2>Alles wat je nodig hebt.<br /><em>Niets wat je niet nodig hebt.</em></h2></div><p>Geen ingewikkelde systemen. Wel een helder overzicht en meer tijd voor je gasten.</p></div>
        <div className="tv-benefit-grid">{voordelen.map((v) => <article key={v.nummer} className="tv-benefit"><div className="tv-benefit-top"><span className="tv-benefit-icon">{v.icoon}</span><span>{v.nummer} / 03</span></div><h3>{v.titel}</h3><p>{v.tekst}</p></article>)}</div>
      </div></section>

      <section id="werking" className="tv-section tv-how"><div className="tv-container tv-how-grid">
        <div><p className="tv-eyebrow">ZO WERKT HET</p><h2>Van reserveren<br />tot <em>genieten.</em></h2><p className="tv-how-intro">Een fijne avond begint met een goed overzicht. Tafelvrij helpt je van de eerste boeking tot de laatste service.</p><a className="tv-text-link" href="#contact">Klinkt goed? Praat met ons <span aria-hidden="true">↗</span></a></div>
        <div className="tv-steps">
          <article><span>01</span><div><h3>Jij stelt je zaak in</h3><p>Kies je openingsuren, shiften en hoeveel gasten je per tijdslot kunt ontvangen.</p></div><b>↗</b></article>
          <article><span>02</span><div><h3>Je gasten boeken online</h3><p>Via jouw website kiezen ze een tijdstip en geven ze aan of ze het menu nemen.</p></div><b>↗</b></article>
          <article><span>03</span><div><h3>Jij bent voorbereid</h3><p>Bekijk je dagoverzicht en weet vooraf wat je in de zaal en keuken mag verwachten.</p></div><b>↗</b></article>
        </div>
      </div></section>

      <section className="tv-quote"><div className="tv-container"><span className="tv-quote-star">✳</span><p>Je restaurant draait om mensen.<br /><em>Je reservatiesysteem helpt je daarbij.</em></p><span className="tv-quote-label">MINDER ADMINISTRATIE. MEER AANDACHT.</span></div></section>

      <section className="tv-section tv-faq" aria-labelledby="faq-titel"><div className="tv-container tv-faq-grid">
        <div><p className="tv-eyebrow">GOED OM TE WETEN</p><h2 id="faq-titel">Veelgestelde<br /><em>vragen.</em></h2></div>
        <div className="tv-faq-list">
          <article><h3>Wat is Tafelvrij?</h3><p>Tafelvrij is een online reservatiesysteem voor restaurants. Gasten boeken een tafel en geven aan of ze het menu nemen. Het restaurant beheert de reservaties en shiften in één overzicht.</p></article>
          <article><h3>Kan ik reserveren via mijn eigen website aanbieden?</h3><p>Ja. Je kunt de boekingswidget van Tafelvrij insluiten op je restaurantwebsite, als onderdeel van de pagina of als popup.</p></article>
          <article><h3>Kan ik bepalen hoeveel gasten er per tijdstip boeken?</h3><p>Ja. Je stelt shiften en capaciteit per tijdslot in. Je kunt ook sluitingsdagen en uitzonderingen toevoegen.</p></article>
          <article><h3>Kunnen gasten hun reservatie aanpassen?</h3><p>Via de persoonlijke link in de bevestigingsmail kunnen gasten hun reservatie bekijken, wijzigen of annuleren tot 24 uur vooraf. Daarna contacteren ze het restaurant.</p></article>
        </div>
      </div></section>

      <section id="contact" className="tv-section tv-contact"><div className="tv-container tv-contact-grid">
        <div><p className="tv-eyebrow"><span className="tv-dot" /> ZULLEN WE KENNISMAKEN?</p><h2>Klaar voor meer<br /><em>ruimte aan tafel?</em></h2><p>Benieuwd of Tafelvrij bij jouw restaurant past? Vertel ons wat je zoekt. We denken graag met je mee.</p><div className="tv-contact-flourish" aria-hidden="true">✳</div></div>
        <ContactFormulier />
      </div></section>
    </main>
    <footer className="tv-footer"><div className="tv-container tv-footer-inner"><Link href="/" className="tv-logo"><span className="tv-logo-mark">✳</span> tafelvrij<span className="tv-logo-dot">.</span></Link><p>Gemaakt voor de mensen achter de tafel.</p><div><a href="#contact">Contact</a><Link href="/login">Inloggen ↗</Link></div></div><div className="tv-container tv-footer-bottom">© Tafelvrij <span>Een product van <a href="https://hawk-ict.be/">Hawk-ICT ↗</a></span></div></footer>
  </div>;
}
