use meta_utils::find_constructor;
use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, AttributeArgs, ImplItem, ItemFn, ItemImpl, ReturnType, Signature};

mod args;
mod bridging;
mod meta_utils;
mod registration;
mod types;

use args::parse_arguments;
use bridging::generate_bridging_fn;
use registration::generate_registration;
use types::{get_type_name, is_valid_constructor, should_export_method};

/// Generate exported function code
fn gen_jsonized_fn(
    signature: &Signature,
    call_path: proc_macro2::TokenStream,
    type_name: Option<&str>,
) -> proc_macro2::TokenStream {
    let fn_name = &signature.ident;
    let args = parse_arguments(&signature.inputs);

    let struct_ident = quote::format_ident!("{}_{}_Args", type_name.unwrap_or(""), fn_name);
    let register_ident =
        quote::format_ident!("__register_method_{}_{}", type_name.unwrap_or(""), fn_name);

    let ret_type = match &signature.output {
        ReturnType::Default => quote! { () },
        ReturnType::Type(_, ty) => quote! { #ty },
    };

    let args_struct = args::generate_args_struct(&struct_ident, &args);
    let (bridging_fn, bridging_fn_ident) =
        generate_bridging_fn(fn_name, &struct_ident, &args, &ret_type, call_path);

    let route_name = format!(
        "{}{}",
        type_name.map_or(String::from(""), |t| format!("{}.", t)),
        fn_name
    );
    let registration = generate_registration(&register_ident, &route_name, &bridging_fn_ident);
    quote! {
        #args_struct
        #bridging_fn
        #registration
    }
}

/// The attribute macro: `#[jsonize]`
/// Derive a function that takes a JSON object as input and returns a JSON object as output,
/// mirroring the original function's signature.
/// The derived function is registered in a global static vector `EXPORTED_FUNCTIONS`.
#[proc_macro_attribute]
pub fn jsonize(_attr: TokenStream, item: TokenStream) -> TokenStream {
    let parsed_fn = parse_macro_input!(item as ItemFn);
    let fn_name = &parsed_fn.sig.ident;
    let jsonized_fn = gen_jsonized_fn(&parsed_fn.sig, quote! { #fn_name }, None);

    let expanded = quote! {
        #parsed_fn
        #jsonized_fn
    };

    expanded.into()
}

/// The attribute macro for exporting methods of a singleton struct: `#[jsonize_singleton]`
/// Derive a function that takes a JSON object as input and returns a JSON object as output,
/// mirroring the original method's signature.
/// The derived function is registered in a global static vector `EXPORTED_FUNCTIONS`.
/// The singleton instance is also registered as a global static variable.
#[proc_macro_attribute]
pub fn jsonize_singleton(attr: TokenStream, item: TokenStream) -> TokenStream {
    let attr_args = parse_macro_input!(attr as AttributeArgs);
    let constructor = find_constructor(attr_args)
        .expect("Missing `constructor` argument for `jsonize_singleton`");
    let impl_block = parse_macro_input!(item as ItemImpl);
    let self_ty = &impl_block.self_ty;
    let type_name = get_type_name(self_ty);
    let instance_ident = quote::format_ident!("GLOBAL_{}_INSTANCE", type_name.to_uppercase());

    let mut methods = Vec::new();
    let mut has_constructor = false;

    for item in &impl_block.items {
        if let ImplItem::Method(method) = item {
            if is_valid_constructor(&constructor, method) {
                has_constructor = true;
                continue;
            }

            if !should_export_method(method) {
                continue;
            }

            let method_name = &method.sig.ident;
            let jsonized_fn = gen_jsonized_fn(
                &method.sig,
                quote! { #instance_ident.#method_name },
                Some(&type_name),
            );

            methods.push(jsonized_fn);
        }
    }

    if !has_constructor {
        panic!("No zero-arg `{}` found for type {}", constructor, type_name);
    }

    let constructor_ident = quote::format_ident!("{}", constructor);
    let instance_code = quote! {
        ::once_cell::sync::Lazy::new(|| {
            #self_ty::#constructor_ident()
        })
    };

    let expanded = quote! {
        #impl_block

        #[allow(non_upper_case_globals)]
        pub static #instance_ident: ::once_cell::sync::Lazy<#self_ty> = #instance_code;

        #( #methods )*
    };

    expanded.into()
}
