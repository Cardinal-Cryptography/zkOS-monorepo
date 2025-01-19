use proc_macro2::Ident;
use quote::{format_ident, quote};
use syn::{FnArg, Pat, Type};

/// Helper struct to store parsed argument information
pub struct ArgumentInfo {
    pub name: Ident,
    pub ty: Box<Type>,
}

/// Parse function arguments into a vector of ArgumentInfo
pub fn parse_arguments(
    inputs: &syn::punctuated::Punctuated<FnArg, syn::token::Comma>,
) -> Vec<ArgumentInfo> {
    let mut args = Vec::new();

    for (i, arg) in inputs.iter().enumerate() {
        if let FnArg::Typed(pat_type) = arg {
            let arg_name = match &*pat_type.pat {
                Pat::Ident(ident) => ident.ident.clone(),
                _ => format_ident!("arg{}", i),
            };
            args.push(ArgumentInfo {
                name: arg_name,
                ty: pat_type.ty.clone(),
            });
        }
    }

    args
}

/// Generate Deserealizable struct definition for function arguments
pub fn generate_args_struct(
    struct_name: &Ident,
    args: &[ArgumentInfo],
) -> proc_macro2::TokenStream {
    let fields = args.iter().map(|arg| {
        let name = &arg.name;
        let ty = &arg.ty;
        quote! { pub #name: #ty }
    });
    let fields_ts = quote! {
        #(#fields),*
    };

    quote! {
        #[allow(non_camel_case_types)]
        #[derive(::serde::Deserialize)]
        struct #struct_name {
            #fields_ts
        }
    }
}
