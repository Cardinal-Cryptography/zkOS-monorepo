use proc_macro2::Ident;
use quote::quote;

use crate::args::ArgumentInfo;

/// Generate bridging function that converts between JSON and native types
/// JSON is parsed into a Deserealizable struct, then the function is called
/// with the struct fields as arguments. The result is then serialized back
/// into JSON.
pub fn generate_bridging_fn(
    fn_name: &Ident,
    struct_name: &Ident,
    args: &[ArgumentInfo],
    ret_type: &proc_macro2::TokenStream,
    call_path: proc_macro2::TokenStream,
) -> (proc_macro2::TokenStream, Ident) {
    let arg_names: Vec<_> = args.iter().map(|arg| &arg.name).collect();
    let bridging_name = quote::format_ident!("{}_json", fn_name);

    (
        quote! {
            #[allow(non_snake_case)]
            fn #bridging_name(input: ::serde_json::Value) -> ::serde_json::Value {
                let args: #struct_name = match ::serde_json::from_value(input) {
                    Ok(val) => val,
                    Err(e) => {
                        return ::serde_json::json!({
                            "error": format!("Invalid input JSON: {}", e)
                        });
                    }
                };

                let result: #ret_type = #call_path(#( args.#arg_names ),*);
                ::serde_json::json!(result)
            }
        },
        bridging_name,
    )
}
