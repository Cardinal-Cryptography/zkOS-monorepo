from utils import *

C = [0x09ac1c9e3e10275d303775ee5156cac5797286885ab6e9996cabd920c6d7301c,
     0x08f060c5232c1aa1af16c66c01f856ce21a23b904d785d93fc3eb1936ab1d138,
     0x16c305c00e00f6e363bb8a77d744aa2b635d2dbffc314489dcee7d40d2c46f41,
     0x1d26c1b8604f1fefd244c85950d363b0f00f76395549b57eee8974e94825001f,
     0x1ccfa9f0032a44338781dd65f6cbaf4f0221159ad6066a1d7118c7001f00a727,
     0x288e070870c152221cae14497e6d15f0477b166d87aa3fe424b27c16f24647f3,
     0x09799017ebafb853028ed86c952401f13a8ae699124b6ff91d465f95d15e682e,
     0x0e24363e8b1a38eb5f7ea8b4fb9be5d5a042286a1d101aa9b68f142b31cfcbba,
     0x23d15496aaf8d08c941e5f0e51f9c3da425f63fe7de65a757de241ff9dd858d4,
     0x0b59ce33289fde6d322091a8cf0274febf2a8c9947a6fe77df005eda0ce72358,
     0x246a6775827e13f8b5106f608d5ce6b6b0164b2930dd5f8a651319d495159c32,
     0x22c35a1c50346166066d9eac2cf28030fbeaffb92f6c4abf780db30314c455b5,
     0x09d4b0f893beb6c2299d8bf8d4abc4040cbee7e8200c615df858c1f12117e6fe,
     0x1b1cfc9db86ef3d2bc2fc8d3d4fc5af7cc309c56ff4da090f27b309462892c7d,
     0x1e5961cb7b443b1cede329a082a12391d085394cb15f059b337f2a68ec03238c,
     0x1a9bdaf4d98d73a9eda4e6d5e49e2b1f4f118e4e7747db22166adfb526cf7bdc,
     0x04b9b276e23c2b70abad7ff5979b53d43bf81bd62bc887cedf26514a56417764,
     0x0a7f9bcc69487481163ff3c9b9528601c7c585a99dedb947f4b06d4e11232e09,
     0x0892b44681eb2dbff423a072a414fe729eb8b6e0afbc4cce107d23420fb50b5a,
     0x22986810068c1126789654166390768aef29a4fa42099e70d4f88e1e397f33c3,
     0x1fd9742bb052485d8ec14535c8f547ac061594d868791e848ad63050d41e7e67,
     0x20afd72e943df193472287d025af8b15b7e1f33bc8dfb4e66ff418c21e29726d,
     0x29c8dfe8bd87048f764516a278b06202621232826c0d6f44ccc7b16d3f4db4d0,
     0x0c0d559596149f8ef8a2363173580a95dbb0a48d3df6692d8c464d5458d750a2,
     0x12d81fd7a038cecc3fb00c14f1aa69a37f466f88adcfde5399183fe8e4e1e891,
     0x2639eecb74b9039c5bafa3340977d4370324c06fbe8ac469f49954138d69418f,
     0x20803d5ef9dac956ff314289a051a1b188d83dc28eb0537b63d11ecccb598f60,
     0x2c06b7aa2e130ce462522972d69a14a49aabb0ab04dd1171bac0d98e76a51d57,
     0x0734c6c6d4ca8929a64277d878d22b708565255eb0f403d1405fe22f263df354,
     0x258434f4223a24498e4218185d147b9c8a86366eb9c2c8d0e83636415da25efd,
     0x20c664405dff550ee70c1018f904c1b730a40c809e05c2335f386d2f260b2271,
     0x1b2e3814ca161b5ea31300e1d93917de17bd3ae23d829f1d50a1fe45b1a3bf92,
     0x278bcde59972a426341454d7133f674b9757018decefd9ef427c15a1dfeba495,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x1289a9dea798f17a5ccdf7d6fbb874344a006f4fb8ba3cfca04aa825e5576f9b,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x193cc49c2a7b29ca0f2f48ee0b888573420fbad1f6940e33d222122ef9c19ff1,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x08f0817ee0880ca1a9c364cb822dc62bfb8e55e0600aba626fd60632032e3d26,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0743cca2f5f52aba55f00a836544be74bdcd58d00a469106a150209bdeabefa3,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0b40ae087bb22d27dbb604e1db3d7a4290344dcff3a14d36133f917de696fbaa,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x280c17f4eb155642545866c3e106116fab62d463ee09a23161d9fd21dd6ebece,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x25a9c20bb4c16c2d4b8420bee82f4ae13a33f3162c5dd671c072241068c002e6,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x077f1f9faffdd2b6f95abbaa8ad87d1381af6f6d33cc2a1ea59b017bc217d6b0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x234378508dcbc7dfc0703e93b0792d3515dbbe6e6e2eab128e80bfcf7b7c113b,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x1cf3aa5f02ee2df6d3f87d3ca5dd456fd1ae4dd59855886c3d1ff8a129a35317,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x2152736c3d4ccb7e44a53b81e7904987bf0a4313f72b61846fa9070c550bb05a,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0b1b1f58d94fcd20dc0e63473601849c3270b1ec9fea41262650eafe89c46dd3,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0df8cc60cf9f45ec72e8b8c30c52593b78696c11afcec5bdebc4f53b3c1930bc,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x2923b54561480b74a7933a0d20b13ce4e506fd697b01ee3e0deca8401a0246a6,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x2aa399823b60100f7c89f6fb73fed21fbf2f59971d284e623344b9300ff8a5db,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0561ce1ebf3b63833e454b8fcea1cc9c3a9ca9b743614421e9931f618a5e5726,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0925bb9e3066b445c08b8312d92fdcc1e51df0680ab66799e8b2a2b21d392957,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0c04706a3b94201828d0f0494a36474500550dc1201f8a2f62792cddbbd8f32b,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0128dde8a49eed960361fe3bd37c05b2b846d0b470e30ab2ea73c79b1ea8f323,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x03df347dcbd8e034286952884ce5c92ed0638681e20b634cd8d610e09b3bd9a8,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x1fca7c1836ff76d5413a1c442095f23fe173f2b81355b9e6d08c780a8419dd27,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x26be35036c894b8c5b7f76b7f145fc1b11b6edb6d36e5529ed6b0f177c8e5629,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x2de7b1981ddc04aac96f35f662c504ec108005cd939424eda85d942c5bccd6d8,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x1eb6f16a003ad510060db7c97327d746589f0806de290d3328c336ebc9b47b2f,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x02e489412625cfc78e81a80ebccf748bdb3530e2560cfd11c5883e153a4b7495,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x03acda95d5fb7131bfaaa47f14f31b952cd48105c60f18e488d4a144c314418e,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x2d326dafb456c100382599a32009d66699fe32f3c286ab85419068969dcca58e,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x12a1d012ae0f0f5d2b991a6fa6127383ff21e7657c0ba89a51e1bf013bcbcf6a,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x1833c5da8b3a3e1d6ce53a1c1c49878cc5bdcfec193a4a6885e582d2878bdf5d,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x18ab263b20a35eb4db42a2e37c84b7fe9aa6f32af02223e03a0faa3c21f7399c,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x20da99b866567c65abef92c5c53eaf0da86f2c4d9f77b48ebd465e77b1a2e3ea,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x2b7b9e823566cd468a1b05a6809e0aa1562991dee2575d047cec1e202f801fb5,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x2a6506e6758a51e2da28e7d2f9cb10e17ad2373d452f6b7eabc2a91b13b5e7f3,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x1b9f6c751d69078cea6274cb5f8d6da5a8ff26f4a127a5fd1855420df0b243a2,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x124d93ec00906df0029235dabb955e93ef29334d3006bc6e2e02bb2f25ba0e34,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x048813019294fad3449ca77fd59404ff2df976299b96ee33921e96eaab51e8ff,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x22a1d2d95c972af73f98bf9db89ba610dac6bd10e438d996028a424373411a25,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x029bf064ff8f123580d2341743905526043412990b6c2a060e503010f651beea,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x068ca3e7d66cff7b5fb3d4ace5689e4ac038db81fb237e4530b8d01c6019cab3,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x12b1511dfe65b516dde917f073f64c81b645383bbb7720342d0dd20888c77010,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x2e12974776ceed6cf82c61638595671595d62d5993ffdbc088222b484c6fa016,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x170f0ff28204619b05acfb5bd5a358b2216ab705725b38c3931a87ab0a1cfb6a,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x147fb5dc45a782811ea5cb869bedac4bb40499e2452783b351703e46bc41615b,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x02d2c5dd59168e8aff8f31beb7ba9883025ea4e213d25f7cdcb4ff82197bfbdd,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x26923d57346cb47f2d0235fca236fea36d0458d3ca92c21ea7dd3c9378ebc9e0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x283a2ae05ef6514d3c0824e37466c81fccc274c3a314e4b20292fc11d27961dd,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0fdcc959ede1ffb97b25ea49ea0a3d8a0d4079356b3ec111041b1a10e0700f32,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x0,
     0x1372a6901a4ec451f5b96b9fc628e326c0112e89d2c54185b3dfe5569d85318c,
     0x2512c8947f0079f2cb6cd5a0f619b95f24f856f4a1cf1f38c1c5bc0f9de24031,
     0x258b296d643fe88e3e786927741178c5f304221d8abdff3ba000a1ce743ed959,
     0x1d480d8170885f4e3731710f70ae26083135629a34a46f6917bd868a97a694c9,
     0x1c2ace4bdd9a812286bf27022dc093a6c3a9b3690f4c86465e6ce4f511f60a0e,
     0x0e0e6d53dd4248d145389a29da1970dd8a97519e42fabb399e684e5ca47cd675,
     0x2ecdf548f684b9cd6be8d2fa80a5f9568065ad78fdb5d0ec26bc6bec86a5e321,
     0x24895602e3e9f930baee72146f0c74e94c12fd9edc4730ecae075cb7deef1160,
     0x22908a9bf937a4abd33bee36b37a6ef13d6a6e1e45918f01d491ecf2b9b7102e,
     0x21a12f6ceb8b4f34de7d7a341667da38e0dd80966b26ffb76bf81a0fcf433ddf,
     0x19b7cede537d8a7d13a0a66d55bf6632a8574ded92a54a679349aaa03edde619,
     0x0baa9c79fdc85061922dedbe4cf32fb3c848f98c9438703ecbd8197884ada1e6,
     0x00f62c3ddeb876748d679f5e6a8bfabe70dee502d26ab578670293c44179e5be,
     0x1cb1f7ec2c74394b8b62115ccac06d81fc4de75f6200a6c862bec32a9d545438,
     0x0c326cd80ccd7efeef332da985857ec8431e72a34254a9e674dc9209eaa9c387,
     0x2d5d55cf84ed356ead441b27826a273e99593d00ca87e1f9b016550582ae4bea,
     0x15148cdd8b09b38f43c45ba811215f05b7395bd3b7da45ee81182a5639352f79,
     0x246d469cf15110e4e87b0560ba5dfbd49173a2c39f528fd4a09bb2b04b903575,
     0x04421c01d68b6daa5d8a924014e1a1282f8ffbc80aaff134ec95f936e5d38911,
     0x25c8130080eeaf48c6fb5ea35b270573f713e5abc1c134481e8ae51297bf4ee4,
     0x072034411f737d50601df3386b0b31445c817d7de3e3b6121ee45082a70c6734,
     0x0e2f84eb9c68559e895dc66cfed4e044f055b75eeef9c9b8b53e0fce7b6f2878,
     0x02f49f929c0b519583001275c9233c16e5a505059d506c2d7004fdb4c8c99865,
     0x07b6bf158a9a749d17660ef947a2752388d3092f98832c39440501507d72ca11,
     0x11dbdc3a4a54643a97bcfde065920e619d3ca193bbad2cd2204de91c19e47328,
     0x1b334393e11a3c268544ad1c564c63fb371d428fac91fb440e5b28840bd81b09,
     0x25717982e0fb2a83a013ebef07f8396a7309ff31a9f8d90f204081628f9fff51,
     0x2095152e0c43304da9c8e85dfa9096e3d340075ed8b223dec2a11e3d7bc4af84,
     0x0d9f3ccccb95ef72eee93f76ec5cef9c82379ce31e835b7e4698af7289be2bd0,
     0x0c1321ae313144a9705d1ccc5db5cf5fd6e33374cb62b477d7c3ff27a1bebc37,
     0x2bb501181adff644f38d7688e96f065c987ba451283620d3d64ee35b9e14862b,
     0x2205947785d825af9b0dbb3d9b503eafb63d1af46c171c3f598338b28888d89e]

D = [2600766909924179814780409961696866414079699656430070499803459729017893381997,
     19293363242678774625215171492393209093707286181479006293654394057747218353607,
     21414786808156610356356451480905960406647514095406216853368573063004475600640,
     8215135898581116354906741804378477022438799156627805573019887031189487620936,
     9165814748476180913577766403125055556952884368727238651703828504915350029819,
     15078459252378813527385228808553999657222567675360137586804698725603240352055,
     5648186893216350474836221186116590993767413676065426352255299742021094533501,
     20725344080263893594397636575905698660034655258256134536883719628954264697683]
T = 8
M = [[10, 14, 2, 6, 5, 7, 1, 3],
     [8, 12, 2, 2, 4, 6, 1, 1],
     [2, 6, 10, 14, 1, 3, 5, 7],
     [2, 2, 8, 12, 1, 1, 4, 6],
     [5, 7, 1, 3, 10, 14, 2, 6],
     [4, 6, 1, 1, 8, 12, 2, 2],
     [1, 3, 5, 7, 2, 6, 10, 14],
     [1, 1, 4, 6, 2, 2, 8, 12]]

ALPHA = 7
ROUNDS_F = 8
ROUNDS_P = 48

def define_functions():
    return f'''

    function sum() {{
        {store0(addmod(add(addmod(add(load0(), load1(), load2(), load3(), load4()), load5()), load6()), load7()), swap=True)}
    }}

    function mm4(a, b, c, d) {{
        let t0 := {add('mload(a)', 'mload(b)')}        //  a +  b
        let t1 := {add('mload(c)', 'mload(d)')}        //          + c +  d
        let t2 := {add('mload(b)', 'mload(b)', 't1')}  //    + 2b  + c +  d
        let t3 := {add('mload(d)', 'mload(d)', 't0')}  //  a +  b      + 2d
        let t4 := {add('t1', 't1')}                    //           2c + 2d
            t4 := {addmod('t4', 't4')}                     //           4c + 4d
            t4 := {addmod('t4', 't3')}                     //  a +  b + 4c + 6d
        let t5 := {add('t0', 't0')}                    // 2a + 2b
            t5 := {addmod('t5', 't5')}                     // 4a + 4b
            t5 := {addmod('t5', 't2')}                     // 4a + 6b + c +  d

        mstore(a, {addmod('t3', 't5')})
        mstore(b, t5)
        mstore(c, {addmod('t2', 't4')})
        mstore(d, t4)
    }}

    function fr_mm() {{
        mm4({MEM[0]}, {MEM[1]}, {MEM[2]}, {MEM[3]})
        mm4({MEM[4]}, {MEM[5]}, {MEM[6]}, {MEM[7]})

        {store0(add(load0(), load4()), swap=True)}
        {store1(add(load1(), load5()), swap=True)}
        {store2(add(load2(), load6()), swap=True)}
        {store3(add(load3(), load7()), swap=True)}

        {store0(addmod(load0(), load0(swap=True)))}
        {store1(addmod(load1(), load1(swap=True)))}
        {store2(addmod(load2(), load2(swap=True)))}
        {store3(addmod(load3(), load3(swap=True)))}
        {store4(addmod(load4(), load0(swap=True)))}
        {store5(addmod(load5(), load1(swap=True)))}
        {store6(addmod(load6(), load2(swap=True)))}
        {store7(addmod(load7(), load3(swap=True)))}
    }}

    function fr_intro(c0, c1, c2, c3, c4, c5, c6, c7) {{
        let state0 := {add(load0(), 'c0')}
        {pow_store(ALPHA, 'state0', MEM[0])}

        let state1 := {add(load1(), 'c1')}
        {pow_store(ALPHA, 'state1', MEM[1])}

        let state2 := {add(load2(), 'c2')}
        {pow_store(ALPHA, 'state2', MEM[2])}

        let state3 := {add(load3(), 'c3')}
        {pow_store(ALPHA, 'state3', MEM[3])}

        let state4 := {add(load4(), 'c4')}
        {pow_store(ALPHA, 'state4', MEM[4])}

        let state5 := {add(load5(), 'c5')}
        {pow_store(ALPHA, 'state5', MEM[5])}

        let state6 := {add(load6(), 'c6')}
        {pow_store(ALPHA, 'state6', MEM[6])}

        let state7 := {add(load7(), 'c7')}
        {pow_store(ALPHA, 'state7', MEM[7])}
    }}
'''


def init():
    return f'''
    {define_functions()}

    {store0(f'mload({ARG[0]})')}
    {store1(f'mload({ARG[1]})')}
    {store2(f'mload({ARG[2]})')}
    {store3(f'mload({ARG[3]})')}
    {store4(f'mload({ARG[4]})')}
    {store5(f'mload({ARG[5]})')}
    {store6(f'mload({ARG[6]})')}
    {store7('129127208515966861312')}

    fr_mm()
'''


def full_round(r):
    return f'''
{{
    fr_intro({C[T * r]}, {C[T * r + 1]}, {C[T * r + 2]}, {C[T * r + 3]}, {C[T * r + 4]}, {C[T * r + 5]}, {C[T * r + 6]}, {C[T * r + 7]})
    fr_mm()
}}
'''


def partial_round(r):
    return f'''
{{
        let state0 := {add(load0(), C[T * r])}
        {pow_store(ALPHA, 'state0', MEM[0])}

        sum()
        {store0(addmod(mulmod(D[0], load0()), load0(swap=True)))}
        {store1(addmod(mulmod(D[1], load1()), load0(swap=True)))}
        {store2(addmod(mulmod(D[2], load2()), load0(swap=True)))}
        {store3(addmod(mulmod(D[3], load3()), load0(swap=True)))}
        {store4(addmod(mulmod(D[4], load4()), load0(swap=True)))}
        {store5(addmod(mulmod(D[5], load5()), load0(swap=True)))}
        {store6(addmod(mulmod(D[6], load6()), load0(swap=True)))}
        {store7(addmod(mulmod(D[7], load7()), load0(swap=True)))}
}}
'''

if __name__ == '__main__':
    print(generate_code(init, full_round, partial_round, T, ROUNDS_F, ROUNDS_P))
