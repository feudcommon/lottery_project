interface Window {
  Telegram?: {
    WebApp: {
      ready: () => void;
      expand: () => void;
    };
  };
  ethereum?: import('ethers').Eip1193Provider;
}