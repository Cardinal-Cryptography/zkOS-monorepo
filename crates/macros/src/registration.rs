use proc_macro2::Ident;
use quote::quote;

/// Generate registration code for exported functions
/// function is registered in a global static vector
pub fn generate_registration(
    register_name: &Ident,
    fn_name: &str,
    bridging_name: &Ident,
) -> proc_macro2::TokenStream {
    quote! {
        #[doc(hidden)]
        #[allow(non_snake_case)]
        #[ctor::ctor]
        fn #register_name() {
            macros_core::EXPORTED_FUNCTIONS.lock().unwrap().push(
                macros_core::JsonizedFunction {
                    name: #fn_name,
                    func: #bridging_name,
                }
            );
        }
    }
}
