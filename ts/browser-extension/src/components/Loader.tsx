import { LoaderCircle } from 'lucide-react';

type Props = {
  text: string,
};

const Loader = ({ text = 'Loading...' }: Props) => {
  return (
    <div className="flex justify-center items-center min-h-[420px]">
      <div className="flex items-center">
        <LoaderCircle className="w-8 h-8 text-black animate-spin" />
        <p className="ml-3 text-xl font-semibold text-black">{text}</p>
      </div>
    </div>
  );
};

export default Loader;
