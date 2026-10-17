import React from "react";

function usePanelWidth() {
  const [e, t] = React.useState(() =>
    window.innerWidth < 900 ? 0 : Math.min(440, Math.max(360, window.innerWidth * 0.26)),
  );
  return (
    React.useEffect(() => {
      const n = () =>
        t(
          window.innerWidth < 900
            ? 0
            : Math.min(440, Math.max(360, window.innerWidth * 0.26)),
        );
      return (
        window.addEventListener("resize", n),
        () => window.removeEventListener("resize", n)
      );
    }, []),
    e
  );
}
export { usePanelWidth };
