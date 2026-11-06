import { useEffect } from "react";

export default function AdBanner() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error("Falha ao carregar o anúncio do AdSense:", error);
    }
  }, []);

  return (
    <div className="mx-auto my-4 w-full max-w-3xl">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-7276731091349102"
        data-ad-slot="5904240313"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
