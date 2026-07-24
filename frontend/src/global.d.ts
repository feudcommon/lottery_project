interface Window {
  Telegram?: {
    WebApp: {
      ready: () => void;
      expand: () => void;
      initData: string;
    };
  };
  ethereum?: import('ethers').Eip1193Provider;
}