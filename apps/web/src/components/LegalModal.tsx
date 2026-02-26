import { useI18n } from "../i18n";

type LegalModalType = "imprint" | "privacy";

type LegalModalProps = {
  isOpen: boolean;
  type: LegalModalType;
  onClose: () => void;
};

const imprintHtml = `<h1>Impressum</h1>

<p>Daniel Geiger<br />
Strasse<br />
plz ort</p>

<h2>Kontakt</h2>
<p>E-Mail: golist@ge1ger.de</p>`;

const privacyHtmlDe = `<h1>Datenschutz&shy;erkl&auml;rung</h1>
<h2>1. Datenschutz auf einen Blick</h2>
<h3>Allgemeine Hinweise</h3> <p>Die folgenden Hinweise geben einen einfachen &Uuml;berblick dar&uuml;ber,
was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind
alle Daten, mit denen Sie pers&ouml;nlich identifiziert werden k&ouml;nnen. Ausf&uuml;hrliche Informationen zum
Thema Datenschutz entnehmen Sie unserer unter diesem Text aufgef&uuml;hrten
Datenschutzerkl&auml;rung.</p>
<h3>Datenerfassung auf dieser Website</h3> <h4>Wer ist verantwortlich f&uuml;r die Datenerfassung auf dieser
Website?</h4> <p>Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen
Kontaktdaten k&ouml;nnen Sie dem Abschnitt &bdquo;Hinweis zur Verantwortlichen Stelle&ldquo; in dieser
Datenschutzerkl&auml;rung entnehmen.</p> <h4>Wie erfassen wir Ihre Daten?</h4> <p>Ihre Daten werden zum
einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich z.&nbsp;B. um Daten handeln, die Sie in ein
Kontaktformular eingeben.</p> <p>Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch
der Website durch unsere IT-Systeme erfasst. Das sind vor allem technische Daten (z.&nbsp;B. Internetbrowser,
Betriebssystem oder Uhrzeit des Seitenaufrufs). Die Erfassung dieser Daten erfolgt automatisch, sobald Sie diese
Website betreten.</p> <h4>Wof&uuml;r nutzen wir Ihre Daten?</h4> <p>Ein Teil der Daten wird erhoben, um eine
fehlerfreie Bereitstellung der Website zu gew&auml;hrleisten. Andere Daten k&ouml;nnen zur Analyse Ihres
Nutzerverhaltens verwendet werden. Sofern &uuml;ber die Website Vertr&auml;ge geschlossen oder angebahnt
werden k&ouml;nnen, werden die &uuml;bermittelten Daten auch f&uuml;r Vertragsangebote, Bestellungen oder
sonstige Auftragsanfragen verarbeitet.</p> <h4>Welche Rechte haben Sie bez&uuml;glich Ihrer Daten?</h4>
<p>Sie haben jederzeit das Recht, unentgeltlich Auskunft &uuml;ber Herkunft, Empf&auml;nger und Zweck Ihrer
gespeicherten personenbezogenen Daten zu erhalten. Sie haben au&szlig;erdem ein Recht, die Berichtigung oder
L&ouml;schung dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben,
k&ouml;nnen Sie diese Einwilligung jederzeit f&uuml;r die Zukunft widerrufen. Au&szlig;erdem haben Sie das Recht,
unter bestimmten Umst&auml;nden die Einschr&auml;nkung der Verarbeitung Ihrer personenbezogenen Daten zu
verlangen. Des Weiteren steht Ihnen ein Beschwerderecht bei der zust&auml;ndigen Aufsichtsbeh&ouml;rde
zu.</p> <p>Hierzu sowie zu weiteren Fragen zum Thema Datenschutz k&ouml;nnen Sie sich jederzeit an uns
wenden.</p>
<h2>2. Hosting</h2>
<p>Wir hosten die Inhalte unserer Website bei folgendem Anbieter:</p>
<h3>Hetzner</h3> <p>Anbieter ist die Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen (nachfolgend
Hetzner).</p> <p>Details entnehmen Sie der Datenschutzerkl&auml;rung von Hetzner: <a
href="https://www.hetzner.com/de/legal/privacy-policy/" target="_blank" rel="noopener
noreferrer">https://www.hetzner.com/de/legal/privacy-policy/</a>.</p>
<h2>3. Allgemeine Hinweise und Pflicht&shy;informationen</h2>
<h3>Datenschutz</h3> <p>Die Betreiber dieser Seiten nehmen den Schutz Ihrer pers&ouml;nlichen Daten sehr
ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den gesetzlichen
Datenschutzvorschriften sowie dieser Datenschutzerkl&auml;rung.</p>
<h3>Hinweis zur verantwortlichen Stelle</h3> <p>Die verantwortliche Stelle f&uuml;r die Datenverarbeitung auf
dieser Website ist:</p> <p>adresse</p>
<p>Telefon: &#91;Telefonnummer der verantwortlichen Stelle&#93;<br />
E-Mail: &#91;E-Mail-Adresse der verantwortlichen Stelle&#93;</p>
<h3>Speicherdauer</h3> <p>Soweit innerhalb dieser Datenschutzerkl&auml;rung keine speziellere Speicherdauer
genannt wurde, verbleiben Ihre personenbezogenen Daten bei uns, bis der Zweck f&uuml;r die Datenverarbeitung
entf&auml;llt.</p>
<h2>4. Datenerfassung auf dieser Website</h2>
<h3>Cookies</h3> <p>Unsere Internetseiten verwenden so genannte &bdquo;Cookies&ldquo;. Cookies sind kleine
Datenpakete und richten auf Ihrem Endger&auml;t keinen Schaden an.</p>
<p>Quelle: <a href="https://www.e-recht24.de">https://www.e-recht24.de</a></p>`;

const privacyHtmlEn = `<h1>Privacy Policy</h1>
<h2>1. Data protection at a glance</h2>
<h3>General information</h3>
<p>The following information provides a simple overview of what happens to your personal data when you visit this website. Personal data is any data that can be used to identify you personally. Detailed information on data protection can be found in this policy.</p>
<h3>Data collection on this website</h3>
<h4>Who is responsible for data collection on this website?</h4>
<p>Data processing on this website is carried out by the website operator. You can find their contact details in the section “Information on the controller” in this privacy policy.</p>
<h4>How do we collect your data?</h4>
<p>Some data is collected when you provide it to us (for example, data entered in a contact form). Other data is collected automatically or after your consent by our IT systems when you visit the website. This is mainly technical data (e.g. browser, operating system, or time of page access).</p>
<h4>What do we use your data for?</h4>
<p>Some data is collected to ensure that the website is provided without errors. Other data may be used to analyze user behavior. If contracts can be concluded or initiated via the website, transmitted data may also be processed for offers, orders, or inquiries.</p>
<h4>What rights do you have regarding your data?</h4>
<p>You have the right to receive information about the origin, recipient, and purpose of your stored personal data free of charge at any time. You also have the right to request correction or deletion of this data. If you have given consent to data processing, you can revoke this consent at any time for the future.</p>
<h2>2. Hosting</h2>
<p>We host our website content with the following provider:</p>
<h3>Hetzner</h3>
<p>The provider is Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Germany.</p>
<p>Details can be found in Hetzner’s privacy policy: <a href="https://www.hetzner.com/de/legal/privacy-policy/" target="_blank" rel="noopener noreferrer">https://www.hetzner.com/de/legal/privacy-policy/</a>.</p>
<h2>3. General information and mandatory disclosures</h2>
<h3>Data protection</h3>
<p>The operators of this website take the protection of your personal data very seriously. We treat your personal data confidentially and in accordance with statutory data protection regulations and this privacy policy.</p>
<h3>Information on the controller</h3>
<p>The controller responsible for data processing on this website is:</p>
<p>address</p>
<p>Phone: [controller phone number]<br />Email: [controller email address]</p>
<h3>Storage period</h3>
<p>Unless a more specific storage period is stated in this policy, your personal data remains with us until the purpose for processing no longer applies.</p>
<h2>4. Data collection on this website</h2>
<h3>Cookies</h3>
<p>Our web pages use “cookies”. Cookies are small data packages and do not cause any damage to your device.</p>
<p>Source: <a href="https://www.e-recht24.de">https://www.e-recht24.de</a></p>`;

const privacyHtmlEs = `<h1>Pol&iacute;tica de privacidad</h1>
<h2>1. Protecci&oacute;n de datos de un vistazo</h2>
<h3>Indicaciones generales</h3>
<p>La siguiente informaci&oacute;n ofrece una visi&oacute;n general sencilla de lo que sucede con sus datos personales cuando visita este sitio web. Los datos personales son todos aquellos datos con los que se le puede identificar personalmente.</p>
<h3>Recopilaci&oacute;n de datos en este sitio web</h3>
<h4>&iquest;Qui&eacute;n es responsable de la recopilaci&oacute;n de datos en este sitio web?</h4>
<p>El tratamiento de datos en este sitio web lo realiza el operador del sitio web. Puede encontrar sus datos de contacto en la secci&oacute;n “Informaci&oacute;n sobre el responsable” de esta pol&iacute;tica de privacidad.</p>
<h4>&iquest;C&oacute;mo recopilamos sus datos?</h4>
<p>Algunos datos se recopilan porque usted nos los proporciona (por ejemplo, los datos introducidos en un formulario de contacto). Otros datos se recopilan autom&aacute;ticamente o tras su consentimiento mediante nuestros sistemas inform&aacute;ticos al visitar el sitio web. Se trata principalmente de datos t&eacute;cnicos (por ejemplo, navegador, sistema operativo u hora de acceso).</p>
<h4>&iquest;Para qu&eacute; utilizamos sus datos?</h4>
<p>Una parte de los datos se recopila para garantizar una prestaci&oacute;n sin errores del sitio web. Otros datos pueden utilizarse para analizar el comportamiento de los usuarios. Si a trav&eacute;s del sitio web se pueden celebrar o iniciar contratos, los datos transmitidos tambi&eacute;n pueden tratarse para ofertas, pedidos o consultas.</p>
<h4>&iquest;Qu&eacute; derechos tiene respecto a sus datos?</h4>
<p>Tiene derecho a recibir en cualquier momento y de forma gratuita informaci&oacute;n sobre el origen, destinatario y finalidad de sus datos personales almacenados. Tambi&eacute;n tiene derecho a solicitar la correcci&oacute;n o eliminaci&oacute;n de estos datos. Si ha otorgado su consentimiento para el tratamiento de datos, puede revocarlo en cualquier momento con efecto futuro.</p>
<h2>2. Hosting</h2>
<p>Alojamos el contenido de nuestro sitio web con el siguiente proveedor:</p>
<h3>Hetzner</h3>
<p>El proveedor es Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Alemania.</p>
<p>Puede consultar los detalles en la pol&iacute;tica de privacidad de Hetzner: <a href="https://www.hetzner.com/de/legal/privacy-policy/" target="_blank" rel="noopener noreferrer">https://www.hetzner.com/de/legal/privacy-policy/</a>.</p>
<h2>3. Informaci&oacute;n general y obligatoria</h2>
<h3>Protecci&oacute;n de datos</h3>
<p>Los operadores de este sitio web se toman muy en serio la protecci&oacute;n de sus datos personales. Tratamos sus datos personales de forma confidencial y de acuerdo con la normativa legal de protecci&oacute;n de datos y esta pol&iacute;tica de privacidad.</p>
<h3>Informaci&oacute;n sobre el responsable</h3>
<p>El responsable del tratamiento de datos en este sitio web es:</p>
<p>direcci&oacute;n</p>
<p>Tel&eacute;fono: [tel&eacute;fono del responsable]<br />Correo electr&oacute;nico: [correo del responsable]</p>
<h3>Plazo de conservaci&oacute;n</h3>
<p>Si en esta pol&iacute;tica no se indica un periodo de conservaci&oacute;n m&aacute;s espec&iacute;fico, sus datos personales permanecer&aacute;n con nosotros hasta que deje de existir la finalidad del tratamiento.</p>
<h2>4. Recopilaci&oacute;n de datos en este sitio web</h2>
<h3>Cookies</h3>
<p>Nuestras p&aacute;ginas web utilizan las llamadas “cookies”. Las cookies son peque&ntilde;os paquetes de datos y no causan da&ntilde;os en su dispositivo.</p>
<p>Fuente: <a href="https://www.e-recht24.de">https://www.e-recht24.de</a></p>`;

const LegalModal = ({ isOpen, type, onClose }: LegalModalProps) => {
  const { t, locale } = useI18n();

  if (!isOpen) {return null;}

  const privacyHtmlByLocale = {
    de: privacyHtmlDe,
    en: privacyHtmlEn,
    es: privacyHtmlEs,
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="modal__body legal-modal__body">
          <div
            className="legal-modal__content"
            dangerouslySetInnerHTML={{
              __html: type === "imprint" ? imprintHtml : privacyHtmlByLocale[locale],
            }}
          />
        </div>
        <div className="modal__actions">
          <button type="button" className="text-button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
